import { SafetyEncoder, SafetyDecoder } from './types';

export class FullspaceEncoder implements SafetyEncoder {
  encode(data: Buffer): Buffer {
    return data;
  }

  computeEncodedSize(dataSize: number): number {
    return dataSize;
  }
}

export class FullspaceDecoder implements SafetyDecoder {
  decode(data: Buffer, expectedSize: number): Buffer {
    return data.subarray(0, expectedSize);
  }
}