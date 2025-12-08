export const MIN_DIMENSION = 16;
export const MAX_DIMENSION = 2048;
export const MIN_FPS = 4;
export const MAX_FPS = 60;

export interface Layout {
  dimension: number;
  frameSize: number;
  frames: number;
  padding: number;
  totalVideoBytes: number;
  fps: number;
}

const clampEven = (value: number, min: number, max: number): number => {
  const clamped = Math.min(Math.max(value, min), max);
  return clamped % 2 === 0 ? clamped : clamped + 1;
};

export const selectFps = (frameCount: number): number => {
  const raw = Math.ceil(frameCount / 10);
  return clampEven(raw, MIN_FPS, MAX_FPS);
};

export const computeLayout = (totalBytes: number, forcedDimension?: number | null): Layout => {
  if (!Number.isFinite(totalBytes) || totalBytes < 0) {
    throw new Error('Total bytes must be a non-negative number.');
  }

  const buildLayout = (dim: number) => {
    const frameSize = dim * dim * 3;
    const frames = Math.max(1, Math.ceil(totalBytes / frameSize));
    const totalVideoBytes = frames * frameSize;
    return {
      dimension: dim,
      frameSize,
      frames,
      padding: totalVideoBytes - totalBytes,
      totalVideoBytes
    };
  };

  if (forcedDimension !== undefined && forcedDimension !== null) {
    const dim = clampEven(forcedDimension, MIN_DIMENSION, MAX_DIMENSION);
    const layout = buildLayout(dim);
    return { ...layout, fps: selectFps(layout.frames) };
  }

  let best: ReturnType<typeof buildLayout> | null = null;

  for (let dim = MIN_DIMENSION; dim <= MAX_DIMENSION; dim += 2) {
    const layout = buildLayout(dim);
    if (!best) {
      best = layout;
      continue;
    }
    const smallerVideo = layout.totalVideoBytes < best.totalVideoBytes;
    const sameVideoLessPadding = layout.totalVideoBytes === best.totalVideoBytes && layout.padding < best.padding;
    const sameBothSmallerDim =
      layout.totalVideoBytes === best.totalVideoBytes &&
      layout.padding === best.padding &&
      layout.dimension < best.dimension;

    if (smallerVideo || sameVideoLessPadding || sameBothSmallerDim) {
      best = layout;
    }
  }

  if (!best) {
    throw new Error('Unable to compute layout.');
  }

  return { ...best, fps: selectFps(best.frames) };
};