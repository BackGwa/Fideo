import path from 'path';
import { Command } from 'commander';
import { decodeVideoToFile } from '../decoder';
import { logError } from '../logger';
import pkg from '../../package.json';

const main = async () => {
  const program = new Command();
  program
    .name('v2f')
    .description('Extract a file from a video container.')
    .version(pkg.version, '-v, --version', 'Show version')
    .argument('<input_video>', 'Input video path')
    .option('-o, --output <path>', 'Output file path (optional)')
    .helpOption('-h, --help', 'Show help');

  program.parse(process.argv);
  const opts = program.opts<{ output?: string }>();
  const input = program.args[0];
  if (typeof input !== 'string') {
    program.error('Input path is required.');
  }

  const inputPath = path.resolve(input);
  const outputPath = opts.output ? path.resolve(opts.output) : null;

  try {
    await decodeVideoToFile(inputPath, outputPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError(message);
    process.exit(1);
  }
};

void main();