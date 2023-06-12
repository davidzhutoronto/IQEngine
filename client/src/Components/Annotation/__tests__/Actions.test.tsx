import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Actions } from '@/Components/Annotation/Actions';
import React from 'react';
import metadataJson from './AnnotationList.test.meta.json';
import { SigMFMetadata } from '@/Utils/sigmfMetadata';
import { current } from '@reduxjs/toolkit';

describe('Annotation list component', () => {
  test('Annotations modal is not visible on initial render', async () => {
    //Arrange
    const meta = Object.assign(new SigMFMetadata(), JSON.parse(JSON.stringify(metadataJson)));
    render(
      <Actions
        meta={meta}
        index={0}
        annotation={meta.annotations[0]}
        spectrogramHeight={200}
        startSampleCount={10}
        setHandleTop={() => {}}
        setMeta={() => {}}
      ></Actions>
    );

    // Act
    const modal = await screen.findByLabelText('Annotation 0 Modal');

    // Assert
    expect(modal).not.toHaveClass('modal-open');
  });

  test('Annotations modal is visible on toggle', async () => {
    //Arrange
    const meta = Object.assign(new SigMFMetadata(), JSON.parse(JSON.stringify(metadataJson)));

    render(
      <Actions
        meta={meta}
        index={0}
        annotation={meta.annotations[0]}
        spectrogramHeight={200}
        startSampleCount={10}
        setHandleTop={() => {}}
        setMeta={() => {}}
      ></Actions>
    );

    // Act
    const openButton = await screen.findByLabelText('Annotation 0 Modal Open Button');
    await userEvent.click(openButton);

    // Assert
    const modal = await screen.findByLabelText('Annotation 0 Modal');
    expect(modal).toHaveClass('modal-open');
  });

  test('Annotations modal displays annotation', async () => {
    //Arrange
    const meta = Object.assign(new SigMFMetadata(), JSON.parse(JSON.stringify(metadataJson)));

    // Act
    render(
      <Actions
        meta={meta}
        index={0}
        annotation={meta.annotations[0]}
        spectrogramHeight={200}
        startSampleCount={10}
        setHandleTop={() => {}}
        setMeta={() => {}}
      ></Actions>
    );

    // Assert
    const textarea = await screen.findByLabelText('Annotation 0 Modal Text Area');
    const annotation = meta.annotations[0];
    for (const key in annotation) {
      expect(textarea).toHaveTextContent(key);
      expect(textarea).toHaveTextContent(annotation[key]);
    }
  });

  test('Annotations modal is closes when clicking cross', async () => {
    //Arrange
    const meta = Object.assign(new SigMFMetadata(), JSON.parse(JSON.stringify(metadataJson)));

    render(
      <Actions
        meta={meta}
        index={0}
        annotation={meta.annotations[0]}
        spectrogramHeight={200}
        startSampleCount={10}
        setHandleTop={() => {}}
        setMeta={() => {}}
      ></Actions>
    );

    // Act
    const openButton = await screen.findByLabelText('Annotation 0 Modal Open Button');
    await userEvent.click(openButton);

    const closeButton = await screen.findByLabelText('Annotation 0 Modal Close Button');
    await userEvent.click(closeButton);

    // Assert
    const modal = await screen.findByLabelText('Annotation 0 Modal');
    expect(modal).not.toHaveClass('modal-open');
  });

  test('Annotations modal closes when updated', async () => {
    //Arrange
    const meta = Object.assign(new SigMFMetadata(), JSON.parse(JSON.stringify(metadataJson)));

    render(
      <Actions
        meta={meta}
        index={0}
        annotation={meta.annotations[0]}
        spectrogramHeight={200}
        startSampleCount={10}
        setHandleTop={() => {}}
        setMeta={() => {}}
      ></Actions>
    );

    // Act
    const openButton = await screen.findByLabelText('Annotation 0 Modal Open Button');
    await userEvent.click(openButton);

    const updateButton = await screen.findByLabelText('Annotation 0 Modal Update Button');
    await userEvent.click(updateButton);

    // Assert
    const modal = await screen.findByLabelText('Annotation 0 Modal');
    expect(modal).not.toHaveClass('modal-open');
  });

  test('Annotations modal closes when json not valid', async () => {
    //Arrange
    const meta = Object.assign(new SigMFMetadata(), JSON.parse(JSON.stringify(metadataJson)));

    render(
      <Actions
        meta={meta}
        index={0}
        annotation={meta.annotations[0]}
        spectrogramHeight={200}
        startSampleCount={10}
        setHandleTop={() => {}}
        setMeta={() => {}}
      ></Actions>
    );

    // Act
    const openButton = await screen.findByLabelText('Annotation 0 Modal Open Button');
    await userEvent.click(openButton);

    const textarea = await screen.findByLabelText('Annotation 0 Modal Text Area');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'not valid json');

    const updateButton = await screen.findByLabelText('Annotation 0 Modal Update Button');
    await userEvent.click(updateButton);

    // Assert
    const modal = await screen.findByLabelText('Annotation 0 Modal');
    expect(modal).toHaveClass('modal-open');
  });
});
