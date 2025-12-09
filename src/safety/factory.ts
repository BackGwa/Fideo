import { SafetyMode, SafetyEncoder, SafetyDecoder } from './types';
import { FullspaceEncoder, FullspaceDecoder } from './fullspace';
import { MonospaceEncoder, MonospaceDecoder } from './monospace';
import { ThreespaceEncoder, ThreespaceDecoder } from './threespace';

export const createEncoder = (mode: SafetyMode): SafetyEncoder => {
  switch (mode) {
    case 'fullspace':
      return new FullspaceEncoder();
    case 'monospace':
      return new MonospaceEncoder();
    case 'threespace':
      return new ThreespaceEncoder();
  }
};

export const createDecoder = (mode: SafetyMode): SafetyDecoder => {
  switch (mode) {
    case 'fullspace':
      return new FullspaceDecoder();
    case 'monospace':
      return new MonospaceDecoder();
    case 'threespace':
      return new ThreespaceDecoder();
  }
};