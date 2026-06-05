import {
  PROFILE_PHOTO_ALLOWED_MIME_TYPES,
  PROFILE_PHOTO_MAX_BYTES,
  type ProfilePhotoMimeType,
} from '../constants/profilePhotos';

const LOCAL_URI_PREFIXES = ['file:', 'content:', 'ph:', 'assets-library:', 'blob:', 'data:'];

export function isLocalPhotoUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) {
    return false;
  }
  if (LOCAL_URI_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return true;
  }
  return !/^https?:\/\//i.test(trimmed);
}

export function extensionForMimeType(mimeType: ProfilePhotoMimeType): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

function normalizeMimeType(raw: string | undefined | null): ProfilePhotoMimeType | null {
  const mime = (raw ?? '').toLowerCase().split(';')[0].trim();
  if (PROFILE_PHOTO_ALLOWED_MIME_TYPES.includes(mime as ProfilePhotoMimeType)) {
    return mime as ProfilePhotoMimeType;
  }
  return null;
}

function inferMimeTypeFromUri(uri: string): ProfilePhotoMimeType {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

export async function readPhotoUploadPayload(uri: string): Promise<{
  data: ArrayBuffer;
  mimeType: ProfilePhotoMimeType;
  extension: string;
  byteLength: number;
}> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Could not read the selected photo. Try another image.');
  }

  const blob = await response.blob();
  const mimeType = normalizeMimeType(blob.type) ?? inferMimeTypeFromUri(uri);

  if (!PROFILE_PHOTO_ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error('Photo must be a JPEG, PNG, or WebP image.');
  }

  if (blob.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error('Photo is too large. Maximum size is 5 MB.');
  }

  const data = await blob.arrayBuffer();
  return {
    data,
    mimeType,
    extension: extensionForMimeType(mimeType),
    byteLength: blob.size,
  };
}
