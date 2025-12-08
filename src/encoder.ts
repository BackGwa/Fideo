import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { once } from 'events';
import ora from 'ora';

import { computeLayout } from './layout';
import { formatBytes, getExtension, pathExists } from './utils';
import { logInfo, logWarn, styleKV, colors } from './logger';
import { ffmpegPath } from './ffmpeg-path';

const ensureVideoPath = (targetPath: string): string => {
  const parsed = path.parse(targetPath);
  if (parsed.ext) return targetPath;
  const base = parsed.name || parsed.base || 'output';
  return path.join(parsed.dir || '.', `${base}.mp4`);
};

export const encodeFileToVideo = async (
  inputPath: string,
  outputPath?: string | null,
  forcedResolution?: number | null
): Promise<void> => {
  if (!ffmpegPath) {
    throw new Error('Bundled ffmpeg not found. Please install dependencies with npm install.');
  }

  const stats = await fs.promises.stat(inputPath).catch(() => null);
  if (!stats || !stats.isFile()) {
    throw new Error('Input file not found.');
  }

  const fileSize = stats.size;
  const extension = getExtension(inputPath);
  const metadata = `${extension};${fileSize};`;
  const metadataBuffer = Buffer.from(metadata, 'utf8');
  const totalDataBytes = metadataBuffer.length + fileSize;
  const layout = computeLayout(totalDataBytes, forcedResolution ?? undefined);
  const paddingBytes = layout.padding;
  const targetPath = ensureVideoPath(
    outputPath ?? path.join(path.dirname(inputPath), `${path.parse(inputPath).name}.mp4`)
  );

  if (await pathExists(targetPath)) {
    logWarn('Output path exists and will be overwritten.');
  }

  logInfo(styleKV('Input file', inputPath));
  logInfo(styleKV('Output video', targetPath));
  logInfo(
    `${styleKV('Resolution', `${layout.dimension}x${layout.dimension}`)}, ` +
      `${colors.magenta('Frames')}: ${colors.white(String(layout.frames))}, ` +
      `${colors.magenta('FPS')}: ${colors.white(String(layout.fps))}`
  );
  logInfo(
    `${styleKV('Metadata', `${metadataBuffer.length}B`)}, ` +
      `${colors.magenta('Payload')}: ${colors.white(formatBytes(fileSize))}, ` +
      `${colors.magenta('Padding')}: ${colors.white(formatBytes(paddingBytes))}`
  );

  const spinner = ora({ text: 'Encoding...', color: 'cyan' }).start();
  let processed = 0;
  const updateSpinner = () => {
    const pct = Math.min(100, (processed / totalDataBytes) * 100);
    spinner.text = `Encoding ${pct.toFixed(1)}% (${formatBytes(processed)}/${formatBytes(totalDataBytes)})`;
  };

  const ffmpegProcess = spawn(
    ffmpegPath,
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-s:v',
      `${layout.dimension}x${layout.dimension}`,
      '-r',
      String(layout.fps),
      '-i',
      '-',
      '-an',
      '-c:v',
      'libx265',
      '-preset',
      'medium',
      '-x265-params',
      'lossless=1',
      '-g',
      '1',
      '-bf',
      '0',
      '-frames:v',
      String(layout.frames),
      '-pix_fmt',
      'gbrp',
      '-movflags',
      '+faststart',
      targetPath
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] }
  );

  const stderrChunks: string[] = [];
  ffmpegProcess.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk.toString()));
  let spawnErrorMessage: string | null = null;
  const exitPromise = new Promise<number | null>((resolve) => {
    ffmpegProcess.on('error', (err: Error) => {
      spawnErrorMessage = err.message;
      resolve(null);
    });
    ffmpegProcess.on('close', (code: number | null) => resolve(code));
  });

  let streamError: Error | null = null;
  ffmpegProcess.stdin?.on('error', (err: Error) => {
    streamError = err;
  });

  const sendStream = async (): Promise<void> => {
    const stdin = ffmpegProcess.stdin;
    if (!stdin) {
      throw new Error('FFmpeg stdin is not available.');
    }

    const writeChunk = async (chunk: Buffer) => {
      if (!stdin.write(chunk)) {
        await once(stdin, 'drain');
      }
      processed += chunk.length;
      updateSpinner();
    };

    await writeChunk(metadataBuffer);

    const readStream = fs.createReadStream(inputPath);
    for await (const chunk of readStream) {
      await writeChunk(chunk as Buffer);
    }

    if (streamError) {
      throw streamError;
    }

    if (paddingBytes > 0) {
      const padding = Buffer.alloc(paddingBytes, 0);
      await writeChunk(padding);
    }

    if (streamError) {
      throw streamError;
    }

    stdin.end();
  };

  let sendErrorMessage: string | null = null;
  try {
    await sendStream();
  } catch (err) {
    sendErrorMessage = err instanceof Error ? err.message : String(err);
    ffmpegProcess.kill('SIGKILL');
  }

  const exitCode = await exitPromise;
  const detail = stderrChunks.join('').trim();
  if (spawnErrorMessage) {
    spinner.fail('Failed to start ffmpeg.');
    throw new Error(`Failed to start ffmpeg: ${spawnErrorMessage}`);
  }
  if (sendErrorMessage) {
    spinner.fail('Video encoding failed.');
    throw new Error(detail || sendErrorMessage || 'Video encoding failed.');
  }
  if (exitCode !== 0) {
    spinner.fail('Video encoding failed.');
    throw new Error(detail || 'Video encoding failed.');
  }

  spinner.succeed('Video created successfully.');
};