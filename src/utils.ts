import path from 'path';

export const getExtension = (filePath: string): string => path.extname(filePath).replace('.', '');

export const getErrorMessage = (err: unknown): string => err instanceof Error ? err.message : String(err);

export const sanitizeExtension = (ext: string | null | undefined): string =>
  (ext || '').replace(/[^A-Za-z0-9_-]/g, '').toLowerCase();