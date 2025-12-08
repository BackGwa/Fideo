import path from 'path';
import { Command, InvalidArgumentError } from 'commander';
import { encodeFileToVideo } from '../encoder';
import { logError } from '../logger';
import { MIN_DIMENSION, MAX_DIMENSION } from '../layout';
import pkg from '../../package.json';

const parseResolution = (value: string): number => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) {
    throw new InvalidArgumentError('Resolution must be an integer.');
  }
  if (numeric % 2 !== 0 || numeric < MIN_DIMENSION || numeric > MAX_DIMENSION) {
    throw new InvalidArgumentError(`Resolution must be an even integer between ${MIN_DIMENSION} and ${MAX_DIMENSION}.`);
  }
  return numeric;
};

const main = async () => {
  const program = new Command();
  program
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
    .helpOption('-h, --help', 'Show help');

  program.parse(process.argv);
  const opts = program.opts<{ output?: string; resolution?: number }>();
  const input = program.args[0];
  if (typeof input !== 'string') {
    program.error('Input path is required.');
  }

  const inputPath = path.resolve(input);
  const outputPath = opts.output ? path.resolve(opts.output) : null;
  const resolution = opts.resolution ?? null;

  try {
    await encodeFileToVideo(inputPath, outputPath, resolution);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError(message);
    process.exit(1);
  }
};

void main();