import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { once } from 'events';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import { computeLayout } from './layout';
import { getExtension } from './utils';
import { logInfo, logWarn, styleKV } from './logger';
import { ffmpegPath } from './ffmpeg-path';

const ensureVideoPath = (targetPath: string): string => {
  const parsed = path.parse(targetPath);
  if (parsed.ext) return targetPath;
  return path.join(parsed.dir || '.', `${parsed.name || parsed.base || 'output'}.mp4`);
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

  const targetPath = ensureVideoPath(
    outputPath ?? path.join(path.dirname(inputPath), `${path.parse(inputPath).name}.mp4`)
  );

  if (fs.existsSync(targetPath)) {
    logWarn('Output path exists and will be overwritten.');
  }

  const fileSize = stats.size;
  const metadataBuffer = Buffer.from(`${getExtension(inputPath)};${fileSize};`, 'utf8');
  const totalDataBytes = metadataBuffer.length + fileSize;
  const layout = computeLayout(totalDataBytes, forcedResolution ?? undefined);
  const paddingBytes = layout.padding;

  logInfo(styleKV('Input file', inputPath));
  logInfo(styleKV('Output video', targetPath));
  logInfo(
    `${styleKV('Resolution', `${layout.dimension}x${layout.dimension}`)}, ` +
      `${chalk.magenta('Frames')}: ${chalk.white(String(layout.frames))}, ` +
      `${chalk.magenta('FPS')}: ${chalk.white(String(layout.fps))}`
  );
  console.log();

  const encodingBar = new cliProgress.SingleBar({
    format: 'Encoding | {bar} | {percentage}%',
    hideCursor: true,
    clearOnComplete: true
  }, cliProgress.Presets.shades_classic);

  encodingBar.start(totalDataBytes, 0);

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

  const exitPromise = new Promise<number | null>((resolve) => {
    ffmpegProcess.on('error', () => resolve(null));
    ffmpegProcess.on('close', (code: number | null) => resolve(code));
  });

  const streamToFfmpeg = async (): Promise<void> => {
    const stdin = ffmpegProcess.stdin!;
    let processed = 0;

    if (!stdin.write(metadataBuffer)) {
      await once(stdin, 'drain');
    }
    processed += metadataBuffer.length;
    encodingBar.update(processed);

    const fileStream = fs.createReadStream(inputPath, { highWaterMark: 256 * 1024 });

    for await (const chunk of fileStream) {
      const buffer = chunk as Buffer;
      if (!stdin.write(buffer)) {
        await once(stdin, 'drain');
      }
      processed += buffer.length;
      encodingBar.update(processed);
    }

    if (paddingBytes > 0) {
      const padding = Buffer.alloc(paddingBytes, 0);
      if (!stdin.write(padding)) {
        await once(stdin, 'drain');
      }
    }

    stdin.end();
  };

  try {
    await streamToFfmpeg();
  } catch (err) {
    ffmpegProcess.kill('SIGKILL');
    encodingBar.stop();
    throw new Error(err instanceof Error ? err.message : String(err));
  }

  const exitCode = await exitPromise;
  if (exitCode !== 0) {
    encodingBar.stop();
    const detail = stderrChunks.join('').trim();
    throw new Error(detail || 'Video encoding failed.');
  }

  encodingBar.stop();
  logInfo(chalk.green('Video created successfully.'));
};