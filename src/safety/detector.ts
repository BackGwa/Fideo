import { SafetyMode, SAFETY_MARKERS, SAFETY_DETECTION_RANGES } from './types';

export const detectSafetyMode = (firstPixel: Buffer): SafetyMode => {
  const r = firstPixel[0];
  const g = firstPixel[1];
  const b = firstPixel[2];
  const avg = (r + g + b) / 3;

  for (const range of SAFETY_DETECTION_RANGES) {
    if (avg >= range.min && avg <= range.max) {
      return range.mode;
    }
  }

  throw new Error(`Unrecognized safety marker: RGB(${r},${g},${b}), average=${avg.toFixed(2)}`);
};

export const createSafetyMarker = (mode: SafetyMode): Buffer => {
  const marker = SAFETY_MARKERS[mode];
  return Buffer.from([marker.r, marker.g, marker.b]);
};