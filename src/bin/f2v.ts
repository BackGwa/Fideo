import path from 'path';
import { Command, InvalidArgumentError } from 'commander';
import { encodeFileToVideo } from '../encoder';
import { logError } from '../logger';
import { MIN_DIMENSION, MAX_DIMENSION } from '../layout';
import { getErrorMessage } from '../utils';
import pkg from '../../package.json';

const parseResolution = (value: string): number => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric % 2 !== 0 || numeric < MIN_DIMENSION || numeric > MAX_DIMENSION) {
    throw new InvalidArgumentError(`Resolution must be an even integer between ${MIN_DIMENSION} and ${MAX_DIMENSION}.`);
  }
  return numeric;
};

new Command()
  .name('f2v')
  .description('Convert a file to a video container.')
  .version(pkg.version, '-v, --version', 'Show version')
  .argument('<input_file>', 'Input file path')
  .option('-o, --output <path>', 'Output video path (optional, defaults to .mp4)')
  .option(
    '-r, --resolution <even_resolution>',
    `Even square resolution to force (${MIN_DIMENSION}-${MAX_DIMENSION}). Auto if omitted.`,
    parseResolution
  )
  .helpOption('-h, --help', 'Show help')
  .action(async (inputFile: string, opts: { output?: string; resolution?: number }) => {
    try {
      await encodeFileToVideo(
        path.resolve(inputFile),
        opts.output ? path.resolve(opts.output) : null,
        opts.resolution ?? null
      );
    } catch (err) {
      logError(getErrorMessage(err));
      process.exit(1);
    }
  })
  .parse();