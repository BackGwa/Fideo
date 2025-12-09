import { SafetyMode } from './safety/types';

export interface EncodingParams {
  isLossless: boolean;
  x265Params: string;
}

const ENCODING_CONFIGS: Record<SafetyMode, EncodingParams> = {
  fullspace: { isLossless: true, x265Params: 'lossless=1' },
  monospace: { isLossless: false, x265Params: 'crf=20' },
  threespace: { isLossless: false, x265Params: 'crf=20' }
};

export const getEncodingParams = (mode: SafetyMode): EncodingParams => {
  return ENCODING_CONFIGS[mode];
};