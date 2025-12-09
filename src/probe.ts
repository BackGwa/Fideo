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

    execFile(
      ffprobePath,
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,r_frame_rate', '-of', 'json', inputPath],
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr.toString().trim() || 'Failed to run ffprobe.'));
          return;
        }
        try {
          const stream = JSON.parse(stdout.toString())?.streams?.[0];
          if (!stream) {
            reject(new Error('No video stream found.'));
            return;
          }
          const fpsRaw = typeof stream.r_frame_rate === 'string' ? stream.r_frame_rate : '';
          const [num, den] = fpsRaw.split('/').map(Number);
          resolve({
            width: stream.width,
            height: stream.height,
            frameCount: stream.nb_frames ? Number(stream.nb_frames) : null,
            fps: num && den ? num / den : null
          });
        } catch {
          reject(new Error('Failed to parse ffprobe output.'));
        }
      }
    );
  });