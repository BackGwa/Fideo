import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { once } from 'events';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import { logInfo, logWarn, styleKV } from './logger';
import { probeVideo } from './probe';
import { ffmpegPath } from './ffmpeg-path';
import { sanitizeExtension } from './utils';

const METADATA_DELIMITER = 59;
const MAX_METADATA_BYTES = 128;

const resolveOutputPath = (videoPath: string, provided: string | null, ext: string): string => {
  if (provided) {
    const parsed = path.parse(provided);
    if (parsed.ext) return provided;
    return path.join(parsed.dir || '.', `${parsed.name || parsed.base || 'output'}.${ext}`);
  }
  const parsed = path.parse(videoPath);
  return path.join(parsed.dir, `${parsed.name}.${ext}`);
};

export const decodeVideoToFile = async (inputVideoPath: string, outputPath?: string | null): Promise<string> => {
  if (!ffmpegPath) {
    throw new Error('Bundled ffmpeg not found. Please install dependencies with npm install.');
  }

  const stats = await fs.promises.stat(inputVideoPath).catch(() => null);
  if (!stats || !stats.isFile()) {
    throw new Error('Input video not found.');
  }

  const videoInfo = await probeVideo(inputVideoPath);

  logInfo(styleKV('Input video', inputVideoPath));
  logInfo(
    `${styleKV('Resolution', `${videoInfo.width}x${videoInfo.height}`)}, ` +
      `${chalk.magenta('FPS')}: ${chalk.white(videoInfo.fps ? videoInfo.fps.toFixed(2) : 'unknown')}`
  );
  if (videoInfo.width !== videoInfo.height || videoInfo.width % 2 !== 0) {
    logWarn('Video is not an even square; extraction may differ from expectations.');
  }
  console.log();

  const ffmpegProcess = spawn(
    ffmpegPath,
    ['-loglevel', 'error', '-i', inputVideoPath, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let decodingBar: cliProgress.SingleBar | undefined;
  let expectedSize: number | null = null;
  let received = 0;

  const setProgress = () => {
    if (expectedSize !== null && expectedSize > 0 && decodingBar) {
      decodingBar.update(received);
    }
  };

  const stderrChunks: string[] = [];
  ffmpegProcess.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk.toString()));

  const metaBuffer = Buffer.allocUnsafe(MAX_METADATA_BYTES);
  let metaLength = 0;
  let semicolons = 0;
  let metadataParsed = false;
  let extension: string | null = null;
  let outputTarget: string | null = outputPath ?? null;
  let writer: fs.WriteStream | null = null;
  const providedExtRaw = outputPath ? path.parse(outputPath).ext.replace('.', '') : '';
  const providedExt = providedExtRaw ? sanitizeExtension(providedExtRaw) : null;

  await new Promise<void>((resolve, reject) => {
    let done = false;
    const settle = (err?: Error | null) => {
      if (done) return;
      done = true;
      if (writer && !writer.closed) {
        writer.destroy();
      }
      err ? reject(err) : resolve();
    };

    const processPayload = async (chunk: Buffer) => {
      if (expectedSize === null || received >= expectedSize || !writer) return;
      const needed = expectedSize - received;
      const slice = chunk.subarray(0, Math.min(chunk.length, needed));
      if (slice.length > 0) {
        if (!writer.write(slice)) {
          await once(writer, 'drain');
        }
        received += slice.length;
        setProgress();
      }
      if (received >= expectedSize) {
        writer.end();
        ffmpegProcess.stdout?.pause();
        ffmpegProcess.kill('SIGTERM');
        settle();
      }
    };

    const handleChunk = async (chunk: Buffer) => {
      let offset = 0;
      if (!metadataParsed) {
        while (offset < chunk.length && !metadataParsed) {
          const byte = chunk[offset];
          if (metaLength >= MAX_METADATA_BYTES) {
            throw new Error('Could not find metadata header.');
          }
          metaBuffer[metaLength++] = byte;
          if (byte === METADATA_DELIMITER && ++semicolons >= 2) {
            metadataParsed = true;
            const metaText = metaBuffer.subarray(0, metaLength).toString('utf8');
            const parts = metaText.split(';');
            extension = sanitizeExtension(parts[0]);
            expectedSize = Number(parts[1]);
            if (!Number.isFinite(expectedSize) || expectedSize < 0) {
              throw new Error('File size in metadata is invalid.');
            }
            outputTarget = resolveOutputPath(inputVideoPath, outputTarget, extension);
            if (providedExt && providedExt !== extension) {
              logWarn(`Output extension (.${providedExt}) differs from metadata (.${extension}).`);
            }
            if (!outputPath && fs.existsSync(outputTarget)) {
              logWarn('Output file exists and will be overwritten.');
            }
            writer = fs.createWriteStream(outputTarget);
            writer.setMaxListeners(0);
            writer.once('error', (err) => {
              ffmpegProcess.kill('SIGKILL');
              settle(err);
            });

            decodingBar = new cliProgress.SingleBar({
              format: 'Decoding | {bar} | {percentage}%',
              hideCursor: true,
              clearOnComplete: true
            }, cliProgress.Presets.shades_classic);

            decodingBar.start(expectedSize, 0);

            if (expectedSize === 0) {
              writer.end();
              ffmpegProcess.stdout?.pause();
              ffmpegProcess.kill('SIGTERM');
              settle();
              return;
            }

            setProgress();
            const remaining = chunk.subarray(offset + 1);
            if (remaining.length > 0) await processPayload(remaining);
            return;
          }
          offset += 1;
        }
      }

      if (metadataParsed && offset < chunk.length) {
        await processPayload(chunk.subarray(offset));
      }
    };

    ffmpegProcess.stdout?.on('data', (chunk: Buffer) => {
      if (done) return;
      ffmpegProcess.stdout?.pause();
      handleChunk(chunk)
        .then(() => {
          if (!done) ffmpegProcess.stdout?.resume();
        })
        .catch((err) => {
          ffmpegProcess.kill('SIGKILL');
          settle(err as Error);
        });
    });

    ffmpegProcess.on('error', (err) => settle(new Error(`Failed to start ffmpeg: ${err.message}`)));
    ffmpegProcess.on('close', (code: number | null) => {
      if (done) return;
      if (!metadataParsed || (expectedSize !== null && received < expectedSize) || code !== 0) {
        decodingBar?.stop();
        const detail = stderrChunks.join('').trim();
        settle(new Error(detail || 'Video decoding failed.'));
        return;
      }
      settle();
    });
  });

  decodingBar?.stop();

  if (!outputTarget) {
    throw new Error('Output path was not determined.');
  }

  logInfo(chalk.green('File extracted successfully.'));
  return outputTarget;
};