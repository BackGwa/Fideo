import { SafetyMode } from './safety/types';
import { createSafetyMarker } from './safety/detector';

export interface MetadataInfo {
  extension: string;
  fileSize: number;
}

export const createMetadataBuffer = (info: MetadataInfo, safetyMode: SafetyMode): Buffer => {
  const safetyMarker = createSafetyMarker(safetyMode);
  const metadataText = Buffer.from(`${info.extension};${info.fileSize};`, 'utf8');
  return Buffer.concat([safetyMarker, metadataText]);
};

export const parseMetadata = (buffer: Buffer): MetadataInfo => {
  const metaText = buffer.toString('utf8');
  const parts = metaText.split(';');

  const extension = parts[0];
  const fileSize = Number(parts[1]);

  return { extension, fileSize };
};