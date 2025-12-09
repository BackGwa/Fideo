import { SafetyEncoder, SafetyDecoder, BINARY_THRESHOLD } from './types';

export class MonospaceEncoder implements SafetyEncoder {
  computeEncodedSize(dataSize: number): number {
    return dataSize * 24;
  }

  encode(data: Buffer): Buffer {
    const output = Buffer.allocUnsafe(data.length * 24);
    let writePos = 0;

    for (const byte of data) {
      for (let bitPos = 7; bitPos >= 0; bitPos--) {
        const bit = (byte >> bitPos) & 1;
        const color = bit ? 255 : 0;
        output[writePos++] = color;
        output[writePos++] = color;
        output[writePos++] = color;
      }
    }

    return output;
  }
}

export class MonospaceDecoder implements SafetyDecoder {
  decode(data: Buffer, expectedSize: number): Buffer {
    const output = Buffer.allocUnsafe(expectedSize);
    let readPos = 0;
    let writePos = 0;

    while (writePos < expectedSize && readPos + 23 < data.length) {
      let byte = 0;

      for (let bitPos = 7; bitPos >= 0; bitPos--) {
        const r = data[readPos++];
        const g = data[readPos++];
        const b = data[readPos++];
        const avg = (r + g + b) / 3;

        if (avg >= BINARY_THRESHOLD) {
          byte |= (1 << bitPos);
        }
      }

      output[writePos++] = byte;
    }

    return output.subarray(0, writePos);
  }
}