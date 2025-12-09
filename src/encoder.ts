import fs from 'fs';
import path from 'path';
import os from 'os';
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

interface ChunkInfo {
  index: number;
  start: number;
  end: number;
  size: number;
}

const readChunk = async (
  filePath: string,
  chunk: ChunkInfo,
  metadataBuffer: Buffer | null
): Promise<Buffer> => {
  const buffers: Buffer[] = [];

  if (metadataBuffer && chunk.index === 0) {
    buffers.push(metadataBuffer);
  }

  const stream = fs.createReadStream(filePath, {
    start: chunk.start,
    end: chunk.end - 1,
    highWaterMark: 256 * 1024
  });

  for await (const data of stream) {
    buffers.push(data as Buffer);
  }

  return Buffer.concat(buffers);
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

  const cpuCount = os.cpus().length;
  const chunkSize = Math.ceil(fileSize / cpuCount);
  const chunks: ChunkInfo[] = [];

  for (let i = 0; i < cpuCount; i++) {
    const start = i * chunkSize;
    const end = Math.min((i + 1) * chunkSize, fileSize);
    if (start >= fileSize) break;
    chunks.push({ index: i, start, end, size: end - start });
  }

  const chunkBuffers = await Promise.all(
    chunks.map(chunk => readChunk(inputPath, chunk, chunk.index === 0 ? metadataBuffer : null))
  );

  const totalBuffer = paddingBytes > 0
    ? Buffer.concat([...chunkBuffers, Buffer.alloc(paddingBytes, 0)])
    : Buffer.concat(chunkBuffers);

  const encodingBar = new cliProgress.SingleBar({
    format: 'Encoding | {bar} | {percentage}%',
    hideCursor: true,
    clearOnComplete: true
  }, cliProgress.Presets.shades_classic);

  encodingBar.start(totalDataBytes, 0);

  let processed = 0;
  const updateProgress = () => {
    encodingBar.update(processed);
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

  const exitPromise = new Promise<number | null>((resolve) => {
    ffmpegProcess.on('error', () => resolve(null));
    ffmpegProcess.on('close', (code: number | null) => resolve(code));
  });

  const sendStream = async (): Promise<void> => {
    const stdin = ffmpegProcess.stdin!;
    const chunkWriteSize = 64 * 1024;
    let offset = 0;

    while (offset < totalBuffer.length) {
      const chunk = totalBuffer.subarray(offset, offset + chunkWriteSize);
      if (!stdin.write(chunk)) {
        await once(stdin, 'drain');
      }
      processed += chunk.length;
      offset += chunk.length;
      updateProgress();
    }

    stdin.end();
  };

  try {
    await sendStream();
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