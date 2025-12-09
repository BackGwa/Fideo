#!/usr/bin/env node

import path from 'path';
import { Command } from 'commander';
import { decodeVideoToFile } from '../decoder';
import { logError } from '../logger';
import { getErrorMessage } from '../utils';
import pkg from '../../package.json';

new Command()
  .name('v2f')
  .description('Extract a file from a video container.')
  .version(pkg.version, '-v, --version', 'Show version')
  .argument('<input_video>', 'Input video path')
  .option('-o, --output <path>', 'Output file path (optional)')
  .helpOption('-h, --help', 'Show help')
  .action(async (inputVideo: string, opts: { output?: string }) => {
    try {
      await decodeVideoToFile(
        path.resolve(inputVideo),
        opts.output ? path.resolve(opts.output) : null
      );
    } catch (err) {
      logError(getErrorMessage(err));
      process.exit(1);
    }
  })
  .parse();