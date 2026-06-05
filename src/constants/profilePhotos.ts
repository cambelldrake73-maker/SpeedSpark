export const PROFILE_PHOTOS_BUCKET = 'profile-photos';

/** 5 MB — profile photo upload limit */
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const PROFILE_PHOTO_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type ProfilePhotoMimeType = (typeof PROFILE_PHOTO_ALLOWED_MIME_TYPES)[number];

export const PROFILE_PHOTO_MAX_COUNT = 6;
