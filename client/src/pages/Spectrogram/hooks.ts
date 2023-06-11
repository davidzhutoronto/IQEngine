import { FFT } from '@/Utils/fft';
import { fftshift } from 'fftshift';
import { colMap } from '@/Utils/colormap';
import { QueryState, useQuery, useQueryClient } from '@tanstack/react-query';
import { SigMFMetadata } from '@/Utils/sigmfMetadata';
import { TILE_SIZE_IN_IQ_SAMPLES } from '@/Utils/constants';
import { IQDataSlice } from '@/api/Models';
import { IQDataClientFactory } from '@/api/iqdata/IQDataClientFactory';
import { useCallback } from 'react';

function spliceSamples(samples: Float32Array, fftSize: number): Array<Float32Array> {
  const numSlices = Math.ceil(samples.length / 2 / fftSize);
  const slices: Array<Float32Array> = [];
  for (let i = 0; i < numSlices; i++) {
    const start = i * fftSize * 2;
    const end = Math.min((i + 1) * fftSize * 2, samples.length);
    const slice = samples.slice(start, end);
    slices.push(slice);
  }
  return slices;
}

function applyWindowFunction(samples: Float32Array, windowFunction: string, fftSize: number) {
  // Apply a hamming window and hanning window
  if (windowFunction === 'hamming') {
    for (let window_i = 0; window_i < fftSize; window_i++) {
      samples[window_i] = samples[window_i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * window_i) / (fftSize - 1)));
    }
  } else if (windowFunction === 'hanning') {
    for (let window_i = 0; window_i < fftSize; window_i++) {
      samples[window_i] = samples[window_i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * window_i) / (fftSize - 1)));
    }
  } else if (windowFunction === 'bartlett') {
    for (let window_i = 0; window_i < fftSize; window_i++) {
      samples[window_i] =
        samples[window_i] * ((2 / (fftSize - 1)) * ((fftSize - 1) / 2) - Math.abs(window_i - (fftSize - 1) / 2));
    }
  } else if (windowFunction === 'blackman') {
    for (let window_i = 0; window_i < fftSize; window_i++) {
      samples[window_i] =
        samples[window_i] *
        (0.42 -
          0.5 * Math.cos((2 * Math.PI * window_i) / fftSize) +
          0.08 * Math.cos((4 * Math.PI * window_i) / fftSize));
    }
  }
  return samples;
}

function applyFFT(samples: Float32Array, fftSize: number) {
  const fft = new FFT(fftSize);
  const out: Array<number> = fft.createComplexArray();
  fft.transform(out, samples);
  return out;
}

function getFFTs(samples: Float32Array, fftSize: number = 1024, windowFunction: string = 'hamming') {
  const slices = spliceSamples(samples, fftSize);
  const ffts = slices.map((slice) => {
    slice = applyWindowFunction(slice, windowFunction, fftSize);
    const fft = applyFFT(slice, fftSize);
    return fft;
  });
  return ffts;
}

function getMagnitudes(samples: number[], tempCurrentFftMin: number, tempCurrentFftMax: number) {
  // convert to magnitude
  let magnitudes = new Array<number>(samples.length / 2);
  for (let j = 0; j < samples.length / 2; j++) {
    magnitudes[j] = Math.sqrt(Math.pow(samples[j * 2], 2) + Math.pow(samples[j * 2 + 1], 2)); // take magnitude
  }

  fftshift(magnitudes); // in-place

  magnitudes = magnitudes.map((x) => 10.0 * Math.log10(x)); // convert to dB
  magnitudes = magnitudes.map((x) => (isFinite(x) ? x : 0)); // get rid of -infinity which happens when the input is all 0s

  const fftMax = Math.max(...magnitudes);
  const fftMin = Math.min(...magnitudes);

  // convert to 0 - 255
  magnitudes = magnitudes.map((x) => x - tempCurrentFftMin); // lowest value is now 0
  magnitudes = magnitudes.map((x) => x / (tempCurrentFftMax - tempCurrentFftMin)); // highest value is now 1
  magnitudes = magnitudes.map((x) => x * 255); // now from 0 to 255

  // To leave some margin to go above max and below min, scale it to 50 to 200 for now
  magnitudes = magnitudes.map((x) => x * 0.588 + 50); // 0.588 is (200-50)/255
  return {
    magnitudes,
    fftMax,
    fftMin,
  };
}

function getImageData(magnitudes: number[][], fftSize: number) {
  if (magnitudes.length === 0 || magnitudes[0].length === 0 || fftSize === 0) {
    return '';
  }
  const canvas = document.createElement('canvas');
  canvas.width = fftSize;
  canvas.height = magnitudes.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  const imageData = ctx.createImageData(fftSize, magnitudes.length);
  for (let i = 0; i < magnitudes.length; i++) {
    for (let j = 0; j < fftSize; j++) {
      const index = (i * fftSize + j) * 4;
      let value = magnitudes[i][j];
      if (value < 0) {
        value = 0;
      }
      if (value > 255) {
        value = 255;
      }
      const color = colMap[Math.round(value)];
      imageData.data[index] = color[0];
      imageData.data[index + 1] = color[1];
      imageData.data[index + 2] = color[2];
      imageData.data[index + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  // get the image data in a way that can be set in an img element
  const dataUrl = canvas.toDataURL();
  return dataUrl;
}

export interface IQImageData {
  dataUrl: string;
  fftMax: number;
  fftMin: number;
}

function getIQDataSliceImage(
  meta: SigMFMetadata,
  index: number,
  tileSize: number = TILE_SIZE_IN_IQ_SAMPLES,
  enabled = true,
  tempCurrentFftMin: number,
  tempCurrentFftMax: number,
  fftSize: number = 1024,
  windowFunction: string = 'hamming'
) {
  if (!meta) {
    return useQuery<IQImageData[]>(['invalidQuery'], () => null);
  }
  const { type, account, container, file_path } = meta.getOrigin();

  const client = IQDataClientFactory(type);
  return useQuery<any>(
    [
      'datasource',
      type,
      account,
      container,
      file_path,
      'iq',
      {
        index: index,
        tileSize: tileSize,
      },
    ],
    () => client.getIQDataSlice(meta, index, tileSize),
    {
      enabled: enabled && !!meta,
      staleTime: Infinity,
      select: useCallback(
        (data) => {
          const startTime = performance.now();
          const sampleSplices = spliceSamples(data.iqArray, fftSize);
          const ffts = sampleSplices.map((slice) => {
            slice = applyWindowFunction(slice, windowFunction, fftSize);
            const fft = applyFFT(slice, fftSize);
            return fft;
          });
          const magnitudes = ffts.map((fft) => {
            const result = getMagnitudes(fft, tempCurrentFftMin, tempCurrentFftMax);
            return result;
          });
          const dataUrl = getImageData(
            magnitudes.map((x) => x.magnitudes),
            fftSize
          );
          console.debug('parocess image slice', 'time', performance.now() - startTime, 'index', index);
          return {
            dataUrl,
            fftMax: Math.max(...magnitudes.map((x) => x.fftMax)),
            fftMin: Math.min(...magnitudes.map((x) => x.fftMin)),
          };
        },
        [fftSize, tempCurrentFftMin, tempCurrentFftMax, windowFunction]
      ),
    }
  );
}

export function useFFT() {
  return {
    getFFTs,
    getMagnitudes,
    getImageData,
    getIQDataSliceImage,
  };
}

export function useGetSlicesStatus() {
  const queryClient = useQueryClient();
  function getSlicesStatus(meta: SigMFMetadata, tileSize: number = TILE_SIZE_IN_IQ_SAMPLES) {
    if (!meta) return undefined;
    const { type, account, container, file_path } = meta.getOrigin();
    const totalSlices = Math.ceil((meta?.getTotalSamples() ?? 0) / TILE_SIZE_IN_IQ_SAMPLES);
    const queryStatus: QueryState<IQDataSlice, undefined>[] = [];
    for (let i = 0; i < totalSlices; i++) {
      queryStatus.push(
        queryClient.getQueryState<IQDataSlice>([
          'datasource',
          type,
          account,
          container,
          file_path,
          'iq',
          {
            index: i,
            tileSize: tileSize,
          },
        ])
      );
    }
    return queryStatus;
  }
  return {
    getSlicesStatus,
  };
}
