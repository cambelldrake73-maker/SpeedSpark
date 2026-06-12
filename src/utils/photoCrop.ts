export const PHOTO_CROP_ASPECT = 3 / 4;
export const MIN_PHOTO_ZOOM = 1;
export const MAX_PHOTO_ZOOM = 4;

export interface PhotoCropTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface PhotoCropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getBaseCoverSize(
  frameWidth: number,
  frameHeight: number,
  imageWidth: number,
  imageHeight: number,
): { width: number; height: number } {
  const frameAspect = frameWidth / frameHeight;
  const imageAspect = imageWidth / imageHeight;

  if (imageAspect > frameAspect) {
    return {
      width: frameHeight * imageAspect,
      height: frameHeight,
    };
  }

  return {
    width: frameWidth,
    height: frameWidth / imageAspect,
  };
}

export function clampPhotoCropTransform(
  transform: PhotoCropTransform,
  frameWidth: number,
  frameHeight: number,
  imageWidth: number,
  imageHeight: number,
): PhotoCropTransform {
  const scale = clamp(transform.scale, MIN_PHOTO_ZOOM, MAX_PHOTO_ZOOM);
  const base = getBaseCoverSize(frameWidth, frameHeight, imageWidth, imageHeight);
  const displayWidth = base.width * scale;
  const displayHeight = base.height * scale;
  const maxX = Math.max(0, (displayWidth - frameWidth) / 2);
  const maxY = Math.max(0, (displayHeight - frameHeight) / 2);

  return {
    scale,
    translateX: clamp(transform.translateX, -maxX, maxX),
    translateY: clamp(transform.translateY, -maxY, maxY),
  };
}

export function computePhotoCropRect(input: {
  frameWidth: number;
  frameHeight: number;
  imageWidth: number;
  imageHeight: number;
  transform: PhotoCropTransform;
}): PhotoCropRect {
  const { frameWidth, frameHeight, imageWidth, imageHeight } = input;
  const transform = clampPhotoCropTransform(
    input.transform,
    frameWidth,
    frameHeight,
    imageWidth,
    imageHeight,
  );

  const base = getBaseCoverSize(frameWidth, frameHeight, imageWidth, imageHeight);
  const displayWidth = base.width * transform.scale;
  const displayHeight = base.height * transform.scale;
  const imageLeft = (frameWidth - displayWidth) / 2 + transform.translateX;
  const imageTop = (frameHeight - displayHeight) / 2 + transform.translateY;

  const x0 = clamp(-imageLeft, 0, displayWidth);
  const y0 = clamp(-imageTop, 0, displayHeight);
  const x1 = clamp(frameWidth - imageLeft, 0, displayWidth);
  const y1 = clamp(frameHeight - imageTop, 0, displayHeight);

  const pixelScale = imageWidth / displayWidth;

  const originX = clamp(Math.round(x0 * pixelScale), 0, imageWidth - 1);
  const originY = clamp(Math.round(y0 * pixelScale), 0, imageHeight - 1);
  const width = clamp(Math.round((x1 - x0) * pixelScale), 1, imageWidth - originX);
  const height = clamp(Math.round((y1 - y0) * pixelScale), 1, imageHeight - originY);

  return { originX, originY, width, height };
}

export function getPhotoCropDisplaySize(
  frameWidth: number,
  frameHeight: number,
  imageWidth: number,
  imageHeight: number,
  scale: number,
): { width: number; height: number } {
  const base = getBaseCoverSize(frameWidth, frameHeight, imageWidth, imageHeight);
  return {
    width: base.width * scale,
    height: base.height * scale,
  };
}
