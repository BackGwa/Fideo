import fs from 'fs';
import path from 'path';

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const step = 1024;
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(step)));
  const value = bytes / Math.pow(step, power);
  const precision = value >= 10 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[power]}`;
};

export const getExtension = (filePath: string): string => {
  const ext = path.extname(filePath).replace('.', '');
  return ext || 'bin';
};

export const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.promises.access(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};