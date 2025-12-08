import { execFile } from 'child_process';
import { ffprobePath } from './ffmpeg-path';

export interface VideoInfo {
  width: number;
  height: number;
  frameCount: number | null;
  fps: number | null;
}

export const probeVideo = (inputPath: string): Promise<VideoInfo> =>
  new Promise((resolve, reject) => {
    if (!ffprobePath) {
      reject(new Error('Bundled ffprobe not found. Please install dependencies with npm install.'));
      return;
    }

    const args = [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,nb_frames,r_frame_rate',
      '-of',
      'json',
      inputPath
    ];

    execFile(ffprobePath, args, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr.toString().trim() || 'Failed to run ffprobe.'));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.toString());
        const stream = parsed?.streams?.[0];
        if (!stream) {
          reject(new Error('No video stream found.'));
          return;
        }
        const fpsRaw = typeof stream.r_frame_rate === 'string' ? stream.r_frame_rate : '';
        const fpsParts = fpsRaw.split('/').map((v: string) => Number(v));
        const fps =
          fpsParts.length === 2 && Number.isFinite(fpsParts[0]) && Number.isFinite(fpsParts[1]) && fpsParts[1] !== 0
            ? fpsParts[0] / fpsParts[1]
            : null;
        resolve({
          width: stream.width,
          height: stream.height,
          frameCount: stream.nb_frames ? Number(stream.nb_frames) : null,
          fps
        });
      } catch {
        reject(new Error('Failed to parse ffprobe output.'));
      }
    });
  });