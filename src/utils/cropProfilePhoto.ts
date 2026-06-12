import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeJpeg, encode as encodeJpeg } from 'jpeg-js';
import { Platform } from 'react-native';
import type { PhotoCropRect } from './photoCrop';

function decodeBase64(base64: string): string {
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(base64);
  }
  throw new Error('Base64 decode unavailable');
}

function encodeBase64(binary: string): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }
  throw new Error('Base64 encode unavailable');
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = decodeBase64(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return encodeBase64(binary);
}

function cropRgba(
  data: Uint8Array,
  sourceWidth: number,
  crop: PhotoCropRect,
): Uint8Array {
  const output = new Uint8Array(crop.width * crop.height * 4);

  for (let y = 0; y < crop.height; y++) {
    for (let x = 0; x < crop.width; x++) {
      const sourceIndex = ((crop.originY + y) * sourceWidth + (crop.originX + x)) * 4;
      const targetIndex = (y * crop.width + x) * 4;
      output[targetIndex] = data[sourceIndex];
      output[targetIndex + 1] = data[sourceIndex + 1];
      output[targetIndex + 2] = data[sourceIndex + 2];
      output[targetIndex + 3] = data[sourceIndex + 3];
    }
  }

  return output;
}

async function cropWithCanvas(uri: string, crop: PhotoCropRect): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('Canvas crop unavailable');
  }

  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = crop.width;
        canvas.height = crop.height;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas unavailable'));
          return;
        }

        context.drawImage(
          image,
          crop.originX,
          crop.originY,
          crop.width,
          crop.height,
          0,
          0,
          crop.width,
          crop.height,
        );

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error('Could not load image for crop'));
    image.src = uri;
  });
}

async function cropWithJpegJs(uri: string, crop: PhotoCropRect): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const decoded = decodeJpeg(base64ToUint8Array(base64), { useTArray: true });
  const croppedData = cropRgba(decoded.data, decoded.width, crop);
  const encodedResult = encodeJpeg(
    {
      width: crop.width,
      height: crop.height,
      data: croppedData,
    },
    90,
  );
  const encodedBytes = new Uint8Array(encodedResult as unknown as ArrayLike<number>);

  const outputUri = `${FileSystem.cacheDirectory}profile-crop-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(outputUri, uint8ArrayToBase64(encodedBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });

  return outputUri;
}

export async function cropProfilePhoto(uri: string, crop: PhotoCropRect): Promise<string> {
  if (Platform.OS === 'web') {
    try {
      return await cropWithCanvas(uri, crop);
    } catch {
      return uri;
    }
  }

  try {
    return await cropWithJpegJs(uri, crop);
  } catch {
    return uri;
  }
}
