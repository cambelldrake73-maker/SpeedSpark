import { PROFILE_PHOTOS_BUCKET } from '../constants/profilePhotos';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { isLocalPhotoUri, readPhotoUploadPayload } from '../utils/profilePhotoFile';
import { normalizeSupabaseUrl, SUPABASE_URL } from './supabaseEnv';
import { isSupabaseConfigured, requireSupabase } from './supabase';

export interface ProfilePhotoRecord {
  id: string;
  userId: string;
  storagePath: string;
  publicUrl: string;
  sortOrder: number;
}

interface ProfilePhotoRow {
  id: string;
  user_id: string;
  storage_path: string;
  public_url: string | null;
  sort_order: number;
}

function publicUrlForPath(storagePath: string, storedUrl: string | null): string {
  if (storedUrl) {
    return storedUrl;
  }
  const base = normalizeSupabaseUrl(SUPABASE_URL);
  return `${base}/storage/v1/object/public/${PROFILE_PHOTOS_BUCKET}/${storagePath}`;
}

function mapPhotoRow(row: ProfilePhotoRow): ProfilePhotoRecord {
  const publicUrl = publicUrlForPath(row.storage_path, row.public_url);

  return {
    id: row.id,
    userId: row.user_id,
    storagePath: row.storage_path,
    publicUrl,
    sortOrder: row.sort_order,
  };
}

function createPhotoId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildStoragePath(userId: string, photoId: string, extension: string): string {
  return `${userId}/${photoId}.${extension}`;
}

function findExistingPhotoByUri(
  uri: string,
  existing: ProfilePhotoRecord[],
): ProfilePhotoRecord | undefined {
  const trimmed = uri.trim();
  return existing.find(
    (photo) =>
      photo.publicUrl === trimmed ||
      trimmed.includes(photo.storagePath) ||
      trimmed.includes(photo.id),
  );
}

export async function fetchProfilePhotos(userId: string): Promise<ProfilePhotoRecord[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const op = 'profile_photos.select';
  logSupabaseRequest(op, { userId });

  const { data, error } = await requireSupabase()
    .from('profile_photos')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) {
    throwSupabaseError(op, error);
  }

  return ((data ?? []) as ProfilePhotoRow[]).map(mapPhotoRow);
}

export async function fetchProfilePhotoUrls(userId: string): Promise<string[]> {
  const photos = await fetchProfilePhotos(userId);
  return photos.map((photo) => photo.publicUrl);
}

export async function uploadProfilePhoto(
  userId: string,
  localUri: string,
  sortOrder: number,
): Promise<ProfilePhotoRecord> {
  if (!isSupabaseConfigured) {
    throw new Error('Photo upload requires Supabase configuration.');
  }

  const client = requireSupabase();
  const { data: authData } = await client.auth.getUser();
  if (authData.user?.id !== userId) {
    throw new Error('You can only upload photos to your own profile.');
  }

  const payload = await readPhotoUploadPayload(localUri);
  const photoId = createPhotoId();
  const storagePath = buildStoragePath(userId, photoId, payload.extension);

  const uploadOp = 'storage.profilePhotos.upload';
  logSupabaseRequest(uploadOp, { userId, storagePath, sortOrder, bytes: payload.byteLength });

  const { error: uploadError } = await client.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .upload(storagePath, payload.data, {
      contentType: payload.mimeType,
      upsert: false,
    });

  if (uploadError) {
    throwSupabaseError(uploadOp, uploadError);
  }

  const publicUrl = client.storage.from(PROFILE_PHOTOS_BUCKET).getPublicUrl(storagePath).data
    .publicUrl;

  const insertOp = 'profile_photos.insert';
  logSupabaseRequest(insertOp, { userId, photoId, sortOrder });

  const { data, error: insertError } = await client
    .from('profile_photos')
    .insert({
      id: photoId,
      user_id: userId,
      storage_path: storagePath,
      public_url: publicUrl,
      sort_order: sortOrder,
    })
    .select('*')
    .single();

  if (insertError) {
    await client.storage.from(PROFILE_PHOTOS_BUCKET).remove([storagePath]);
    throwSupabaseError(insertOp, insertError);
  }

  return mapPhotoRow(data as ProfilePhotoRow);
}

export async function deleteProfilePhoto(userId: string, photoId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  const client = requireSupabase();
  const op = 'profile_photos.delete';
  logSupabaseRequest(op, { userId, photoId });

  const { data: row, error: selectError } = await client
    .from('profile_photos')
    .select('storage_path, user_id')
    .eq('id', photoId)
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) {
    throwSupabaseError(op, selectError);
  }
  if (!row) {
    return;
  }

  const { error: deleteRowError } = await client
    .from('profile_photos')
    .delete()
    .eq('id', photoId)
    .eq('user_id', userId);

  if (deleteRowError) {
    throwSupabaseError(op, deleteRowError);
  }

  const storagePath = (row as { storage_path: string }).storage_path;
  const { error: storageError } = await client.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .remove([storagePath]);

  if (storageError) {
    throwSupabaseError('storage.profilePhotos.delete', storageError);
  }
}

export async function reorderProfilePhotos(
  userId: string,
  photoIdsInOrder: string[],
): Promise<void> {
  if (!isSupabaseConfigured || photoIdsInOrder.length === 0) {
    return;
  }

  const client = requireSupabase();
  const op = 'profile_photos.reorder';
  logSupabaseRequest(op, { userId, count: photoIdsInOrder.length });

  await Promise.all(
    photoIdsInOrder.map((photoId, index) =>
      client
        .from('profile_photos')
        .update({ sort_order: index })
        .eq('id', photoId)
        .eq('user_id', userId),
    ),
  );
}

/**
 * Syncs UI photo slots (local + remote URIs) to Storage + profile_photos.
 * Returns public URLs in slot order (non-empty slots only).
 */
export async function syncProfilePhotoSlots(
  userId: string,
  slotUris: string[],
): Promise<string[]> {
  const existing = await fetchProfilePhotos(userId);
  const keptIds: string[] = [];
  const finalUrls: string[] = [];

  for (let sortOrder = 0; sortOrder < slotUris.length; sortOrder += 1) {
    const uri = slotUris[sortOrder]?.trim();
    if (!uri) {
      continue;
    }

    if (isLocalPhotoUri(uri)) {
      const uploaded = await uploadProfilePhoto(userId, uri, sortOrder);
      keptIds.push(uploaded.id);
      finalUrls.push(uploaded.publicUrl);
      continue;
    }

    const matched = findExistingPhotoByUri(uri, existing);
    if (matched) {
      keptIds.push(matched.id);
      finalUrls.push(matched.publicUrl);
    }
  }

  for (const photo of existing) {
    if (!keptIds.includes(photo.id)) {
      await deleteProfilePhoto(userId, photo.id);
    }
  }

  if (keptIds.length > 0) {
    await reorderProfilePhotos(userId, keptIds);
  }

  return finalUrls;
}
