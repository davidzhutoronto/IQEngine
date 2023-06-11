import { TILE_SIZE_IN_IQ_SAMPLES } from '@/Utils/constants';
import { SigMFMetadata } from '@/Utils/sigmfMetadata';
import { getIQDataSlice } from '@/api/iqdata/Queries';
import { getMeta } from '@/api/metadata/Queries';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useIntersectionObserver } from 'usehooks-ts';
import { useFFT, useGetSlicesStatus } from './hooks';
import { useQueryClient } from '@tanstack/react-query';

interface SpectrogramProps {}
interface SpectrogramFragmentProps {
  index: number;
  meta: SigMFMetadata;
  minFFT: number;
  maxFFT: number;
  fftSize: number;
  setMinFFT: (minFFT: number) => void;
  setMaxFFT: (maxFFT: number) => void;
}

export function SpectrogramFragment({
  index,
  meta,
  minFFT,
  maxFFT,
  setMaxFFT,
  setMinFFT,
  fftSize,
}: SpectrogramFragmentProps) {
  const { getFFTs, getMagnitudes, getImageData, getIQDataSliceImage } = useFFT();
  const observerRef = useRef(null);
  const element = useIntersectionObserver(observerRef, {});
  //const { isLoading, data } = getIQDataSlice(meta, index, TILE_SIZE_IN_IQ_SAMPLES, element?.isIntersecting == true);
  const { isLoading, data } = getIQDataSliceImage(meta, index, TILE_SIZE_IN_IQ_SAMPLES, true, minFFT, maxFFT, fftSize);

  useEffect(() => {
    if (data) {
      setMinFFT(data.fftMin);
      setMaxFFT(data.fftMax);
    }
  }, [data]);

  // const fftData = useMemo(() => {
  //   if (data) {
  //     let start = performance.now();
  //     let ffts = getFFTs(data.iqArray, fftSize);
  //     console.debug('time to generate ffts', index, performance.now() - start);
  //     return ffts;
  //   }
  //   return Array<number[]>();
  // }, [data, fftSize]);

  // const magnitudes = useMemo<
  //   {
  //     magnitudes: number[];
  //     fftMin: number;
  //     fftMax: number;
  //   }[]
  // >(() => {
  //   if (fftData.length > 0) {
  //     let start = performance.now();
  //     let mags = fftData.map((fft) => getMagnitudes(fft, minFFT, maxFFT));
  //     let min = Math.min(...mags.map((m) => m.fftMin));
  //     setMinFFT(min);
  //     let max = Math.max(...mags.map((m) => m.fftMax));
  //     setMaxFFT(max);
  //     console.debug('time to generate magnitudes', index, performance.now() - start);
  //     return mags;
  //   }
  //   return [
  //     {
  //       magnitudes: [],
  //       fftMin: 0,
  //       fftMax: 0,
  //     },
  //   ];
  // }, [fftData, minFFT, maxFFT]);

  // const imageData = useMemo(() => {
  //   if (magnitudes.length > 0 && magnitudes[0].magnitudes.length > 0) {
  //     let start = performance.now();
  //     let imgData = getImageData(
  //       magnitudes.map((m) => m.magnitudes),
  //       fftSize
  //     );
  //     console.debug('time to generate image data', index, performance.now() - start);
  //     return imgData;
  //   } else {
  //     return null;
  //   }
  // }, [magnitudes, fftSize]);

  return (
    <div ref={observerRef}>
      {isLoading ? (
        <div className="h-[200px] w-full">
          <div className="h-full w-full bg-gray-200 animate-pulse"></div>
        </div>
      ) : (
        <img src={data?.dataUrl} alt="spectrogram {index}" className="h-[200px] w-full" />
      )}
    </div>
  );
}

export function SpetrogramVirtual() {
  const { type, account, container, filePath } = useParams();
  const { isLoading, data: meta } = getMeta(type, account, container, filePath);
  const [minFFT, setMinFFT] = useState(0);
  const [maxFFT, setMaxFFT] = useState(0);
  const { getSlicesStatus } = useGetSlicesStatus();

  const fftSize = 1024;
  const parentRef = React.useRef();
  const sliceStatus = getSlicesStatus(meta);
  const totalSlices = Math.ceil((meta?.getTotalSamples() ?? 0) / TILE_SIZE_IN_IQ_SAMPLES);
  function updateMinFFT(newMinFFT: number) {
    newMinFFT = Number(newMinFFT.toFixed(2));
    if (newMinFFT < minFFT) {
      console.log('newMinFFT', newMinFFT);
      setMinFFT(newMinFFT);
    }
  }

  function updateMaxFFT(newMaxFFT: number) {
    newMaxFFT = Number(newMaxFFT.toFixed(2));
    if (newMaxFFT > maxFFT) {
      console.log('newMaxFFT', newMaxFFT);
      setMaxFFT(newMaxFFT);
    }
  }
  const rowVirtualizer = useVirtualizer({
    count: totalSlices ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 20,
  });

  useEffect(() => {
    console.log('minFFT', minFFT);
    console.log('maxFFT', maxFFT);
  }, [rowVirtualizer]);
  return (
    <div className="flex flex-auto items-center justify-center">
      <div className="flex-col">
        {isLoading || rowVirtualizer.getTotalSize() < 200 ? (
          <div>Loading...</div>
        ) : (
          <>
            <div className="flex-row">
              <div className="flex flex-row items-center justify-center">
                <span className="text-sm text-gray-500">min FFT: </span>
                <span className="text-sm text-gray-500">{minFFT}</span>
              </div>
              <div className="flex flex-row items-center justify-center">
                <span className="text-sm text-gray-500">max FFT: </span>
                <span className="text-sm text-gray-500">{maxFFT}</span>
              </div>
              <div className="flex flex-row items-center justify-center">
                <span className="text-sm text-gray-500">total slices with succes: </span>
                <span className="text-sm text-gray-500">
                  {sliceStatus.filter((x) => x?.status === 'success').length}
                  of {totalSlices}
                </span>
              </div>
            </div>

            <div
              style={{
                height: '700px',
                width: '1024px',
              }}
              ref={parentRef}
              className="w-full overflow-auto"
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                }}
                className={`relative bg-cyan-600 w-full`}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                  <div
                    key={virtualRow.index}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={
                      virtualRow.index % 2
                        ? `bg-black w-full absolute top-0 left-0`
                        : `bg-gray-100 w-full absolute top-0 left-0`
                    }
                  >
                    <SpectrogramFragment
                      key={virtualRow.index}
                      index={virtualRow.index}
                      meta={meta}
                      minFFT={minFFT}
                      maxFFT={maxFFT}
                      fftSize={fftSize}
                      setMinFFT={updateMinFFT}
                      setMaxFFT={updateMaxFFT}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
