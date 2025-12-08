type InstallerModule = {
  path?: string;
};

const resolveBinary = (installerName: string): string | null => {
  try {
    const pkg = require(installerName) as InstallerModule | undefined;
    return typeof pkg?.path === 'string' ? pkg.path : null;
  } catch {
    return null;
  }
};

export const ffmpegPath = resolveBinary('@ffmpeg-installer/ffmpeg');
export const ffprobePath = resolveBinary('@ffprobe-installer/ffprobe');