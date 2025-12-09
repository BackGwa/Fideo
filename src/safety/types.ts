export type SafetyMode = 'monospace' | 'threespace' | 'fullspace';

export interface SafetyMarker {
  r: number;
  g: number;
  b: number;
}

export const SAFETY_MARKERS: Record<SafetyMode, SafetyMarker> = {
  monospace: { r: 0, g: 0, b: 0 },
  fullspace: { r: 128, g: 128, b: 128 },
  threespace: { r: 255, g: 255, b: 255 }
};

export const SAFETY_MARKER_SIZE = 3;

export interface SafetyDetectionRange {
  min: number;
  max: number;
  mode: SafetyMode;
}

export const SAFETY_DETECTION_RANGES: SafetyDetectionRange[] = [
  { min: 0, max: 32, mode: 'monospace' },
  { min: 96, max: 160, mode: 'fullspace' },
  { min: 223, max: 255, mode: 'threespace' }
];

export const BINARY_THRESHOLD = 128;

export interface SafetyEncoder {
  encode(data: Buffer): Buffer;
  computeEncodedSize(dataSize: number): number;
}

export interface SafetyDecoder {
  decode(data: Buffer, expectedSize: number): Buffer;
}