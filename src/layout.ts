export const MIN_DIMENSION = 16;
export const MAX_DIMENSION = 2048;
export const MIN_FPS = 2;
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

  if (forcedDimension) {
    const layout = buildLayout(clampEven(forcedDimension, MIN_DIMENSION, MAX_DIMENSION));
    return { ...layout, fps: selectFps(layout.frames) };
  }

  let best: ReturnType<typeof buildLayout> | null = null;

  for (let dim = MAX_DIMENSION; dim >= MIN_DIMENSION; dim -= 2) {
    const layout = buildLayout(dim);

    if (layout.frames < MIN_FPS) continue;

    if (
      !best ||
      layout.frames < best.frames ||
      (layout.frames === best.frames && layout.padding < best.padding) ||
      (layout.frames === best.frames && layout.padding === best.padding && layout.dimension > best.dimension)
    ) {
      best = layout;
    }
  }

  if (!best) {
    best = buildLayout(MAX_DIMENSION);
  }

  return { ...best, fps: selectFps(best.frames) };
};