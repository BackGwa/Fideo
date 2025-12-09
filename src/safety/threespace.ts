import { SafetyEncoder, SafetyDecoder, BINARY_THRESHOLD } from './types';

const COLOR_MAP = [
  [0, 0, 0],       // 000
  [0, 0, 255],     // 001
  [0, 255, 0],     // 010
  [0, 255, 255],   // 011
  [255, 0, 0],     // 100
  [255, 0, 255],   // 101
  [255, 255, 0],   // 110
  [255, 255, 255]  // 111
];

export class ThreespaceEncoder implements SafetyEncoder {
  computeEncodedSize(dataSize: number): number {
    const bitCount = dataSize * 8;
    const pixelCount = Math.ceil(bitCount / 3);
    return pixelCount * 3;
  }

  encode(data: Buffer): Buffer {
    const bitCount = data.length * 8;
    const pixelCount = Math.ceil(bitCount / 3);
    const output = Buffer.allocUnsafe(pixelCount * 3);

    let bitPos = 0;
    let writePos = 0;

    for (let i = 0; i < pixelCount; i++) {
      let bits = 0;

      for (let j = 0; j < 3 && bitPos < bitCount; j++) {
        const byteIndex = Math.floor(bitPos / 8);
        const bitOffset = 7 - (bitPos % 8);
        const bit = (data[byteIndex] >> bitOffset) & 1;
        bits = (bits << 1) | bit;
        bitPos++;
      }

      if (bitPos < bitCount || (bitPos % 3 === 0)) {
        bits = bits;
      } else {
        bits = bits << (3 - (bitPos % 3));
      }

      const [r, g, b] = COLOR_MAP[bits];
      output[writePos++] = r;
      output[writePos++] = g;
      output[writePos++] = b;
    }

    return output;
  }
}

export class ThreespaceDecoder implements SafetyDecoder {
  decode(data: Buffer, expectedSize: number): Buffer {
    const output = Buffer.allocUnsafe(expectedSize);
    let readPos = 0;
    let bitBuffer = 0;
    let bitsInBuffer = 0;
    let writePos = 0;

    while (writePos < expectedSize && readPos + 2 < data.length) {
      const r = data[readPos++] >= BINARY_THRESHOLD ? 1 : 0;
      const g = data[readPos++] >= BINARY_THRESHOLD ? 1 : 0;
      const b = data[readPos++] >= BINARY_THRESHOLD ? 1 : 0;

      bitBuffer = (bitBuffer << 3) | (r << 2) | (g << 1) | b;
      bitsInBuffer += 3;

      while (bitsInBuffer >= 8 && writePos < expectedSize) {
        const byte = (bitBuffer >> (bitsInBuffer - 8)) & 0xFF;
        output[writePos++] = byte;
        bitsInBuffer -= 8;
      }
    }

    return output.subarray(0, writePos);
  }
}