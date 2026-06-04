import type {
  DatingPreferences,
  GenderIdentity,
  LookingFor,
  PresentationTag,
  QueerRole,
  SexualOrientation,
  UserProfile,
  VerificationStatus,
} from '../types';
import type { DatingPreferencesRow, ProfileRow } from '../types/database';
import {
  logSupabaseRequest,
  throwSupabaseError,
} from '../utils/supabaseDebug';
import { isSupabaseConfigured, requireSupabase } from './supabase';

function mapProfileRow(row: ProfileRow, photos: string[] = []): UserProfile {
  return {
    id: row.id,
    name: row.display_name || `${row.first_name} ${row.last_name}`.trim(),
    age: row.age,
    location: row.location_label,
    locationLatitude: row.location_latitude ?? undefined,
    locationLongitude: row.location_longitude ?? undefined,
    heightInches: row.height_inches,
    photos,
    genderIdentity: row.gender_identity as GenderIdentity,
    sexualOrientation: row.sexual_orientation as SexualOrientation,
    lookingFor: row.looking_for as LookingFor[],
    queerRoles: row.queer_roles as QueerRole[],
    presentationTags: row.presentation_tags as PresentationTag[],
    personalityTags: row.personality_tags,
    lifestyleTags: row.lifestyle_tags,
    verificationStatus: row.verification_status as VerificationStatus,
  };
}

function mapPreferencesRow(row: DatingPreferencesRow): Partial<DatingPreferences> {
  return {
    ageRangeMin: row.age_range_min,
    ageRangeMax: row.age_range_max,
    heightMinInches: row.height_min_inches,
    heightMaxInches: row.height_max_inches,
    maxDistanceMiles: row.max_distance_miles,
    preferredOrientations: row.preferred_orientations as SexualOrientation[],
    preferredLookingFor: row.preferred_looking_for as LookingFor[],
    preferredQueerRoles: row.preferred_queer_roles as QueerRole[],
    preferredPresentationTags: row.preferred_presentation_tags as PresentationTag[],
    dealbreakers: row.dealbreakers,
    niceToHaves: row.nice_to_haves,
  };
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const client = requireSupabase();
  const profileOp = 'profiles.select';
  const photosOp = 'profile_photos.select';

  logSupabaseRequest(profileOp, { userId });
  logSupabaseRequest(photosOp, { userId });

  const [{ data: profile, error: profileError }, { data: photos, error: photosError }] =
    await Promise.all([
      client.from('profiles').select('*').eq('id', userId).maybeSingle(),
      client
        .from('profile_photos')
        .select('public_url, sort_order')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
    ]);

  if (profileError) {
    throwSupabaseError(profileOp, profileError);
  }
  if (photosError) {
    throwSupabaseError(photosOp, photosError);
  }
  if (!profile) {
    console.log('[SpeedSpark Supabase] ✓ profiles.select (no row yet)', { userId });
    return null;
  }

  const photoUrls = (photos ?? [])
    .map((photo) => photo.public_url)
    .filter((url): url is string => Boolean(url));

  console.log('[SpeedSpark Supabase] ✓ profiles.select', { userId, photoCount: photoUrls.length });
  return mapProfileRow(profile as ProfileRow, photoUrls);
}

export async function fetchPreferences(userId: string): Promise<Partial<DatingPreferences> | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const op = 'dating_preferences.select';
  logSupabaseRequest(op, { userId });

  const { data, error } = await requireSupabase()
    .from('dating_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throwSupabaseError(op, error);
  }
  if (!data) {
    console.log('[SpeedSpark Supabase] ✓ dating_preferences.select (no row yet)', { userId });
    return null;
  }

  console.log('[SpeedSpark Supabase] ✓ dating_preferences.select', { userId });
  return mapPreferencesRow(data as DatingPreferencesRow);
}

export async function upsertProfile(
  userId: string,
  profile: Partial<UserProfile>,
): Promise<UserProfile> {
  const client = requireSupabase();
  const op = 'profiles.upsert';

  const payload = {
    id: userId,
    display_name: profile.name,
    age: profile.age,
    height_inches: profile.heightInches,
    location_label: profile.location,
    location_latitude: profile.locationLatitude ?? null,
    location_longitude: profile.locationLongitude ?? null,
    gender_identity: profile.genderIdentity,
    sexual_orientation: profile.sexualOrientation,
    looking_for: profile.lookingFor,
    queer_roles: profile.queerRoles,
    presentation_tags: profile.presentationTags,
    personality_tags: profile.personalityTags,
    lifestyle_tags: profile.lifestyleTags,
    verification_status: profile.verificationStatus,
    onboarded_at: new Date().toISOString(),
  };

  logSupabaseRequest(op, { userId, fields: Object.keys(payload) });

  const { data, error } = await client.from('profiles').upsert(payload).select('*').single();

  if (error) {
    throwSupabaseError(op, error);
  }

  console.log('[SpeedSpark Supabase] ✓ profiles.upsert', { userId });
  return mapProfileRow(data as ProfileRow, profile.photos ?? []);
}

export async function upsertPreferences(
  userId: string,
  preferences: Partial<DatingPreferences>,
): Promise<Partial<DatingPreferences>> {
  const client = requireSupabase();
  const op = 'dating_preferences.upsert';

  const payload = {
    user_id: userId,
    age_range_min: preferences.ageRangeMin,
    age_range_max: preferences.ageRangeMax,
    height_min_inches: preferences.heightMinInches,
    height_max_inches: preferences.heightMaxInches,
    max_distance_miles: preferences.maxDistanceMiles,
    preferred_orientations: preferences.preferredOrientations,
    preferred_looking_for: preferences.preferredLookingFor,
    preferred_queer_roles: preferences.preferredQueerRoles,
    preferred_presentation_tags: preferences.preferredPresentationTags,
    dealbreakers: preferences.dealbreakers,
    nice_to_haves: preferences.niceToHaves,
  };

  logSupabaseRequest(op, { userId });

  const { data, error } = await client
    .from('dating_preferences')
    .upsert(payload)
    .select('*')
    .single();

  if (error) {
    throwSupabaseError(op, error);
  }

  console.log('[SpeedSpark Supabase] ✓ dating_preferences.upsert', { userId });
  return mapPreferencesRow(data as DatingPreferencesRow);
}

export async function updateTextNotificationsEnabled(
  userId: string,
  enabled: boolean,
): Promise<void> {
  const op = 'profiles.updateTextNotifications';
  logSupabaseRequest(op, { userId, enabled });

  const { error } = await requireSupabase()
    .from('profiles')
    .update({ text_notifications_enabled: enabled })
    .eq('id', userId);

  if (error) {
    throwSupabaseError(op, error);
  }

  console.log('[SpeedSpark Supabase] ✓ profiles.updateTextNotifications', { userId });
}

export { mapProfileRow, mapPreferencesRow };
