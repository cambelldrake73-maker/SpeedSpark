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

export interface ProfileNameFields {
  firstName?: string;
  lastName?: string;
}

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

function buildProfileUpdatePayload(
  profile: Partial<UserProfile>,
  names?: ProfileNameFields,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (names?.firstName !== undefined) {
    payload.first_name = names.firstName;
  }
  if (names?.lastName !== undefined) {
    payload.last_name = names.lastName;
  }
  if (profile.name !== undefined) {
    payload.display_name = profile.name;
  }
  if (profile.age !== undefined) {
    payload.age = profile.age;
  }
  if (profile.heightInches !== undefined) {
    payload.height_inches = profile.heightInches;
  }
  if (profile.location !== undefined) {
    payload.location_label = profile.location;
  }
  if (profile.locationLatitude !== undefined) {
    payload.location_latitude = profile.locationLatitude ?? null;
  }
  if (profile.locationLongitude !== undefined) {
    payload.location_longitude = profile.locationLongitude ?? null;
  }
  if (profile.genderIdentity !== undefined) {
    payload.gender_identity = profile.genderIdentity;
  }
  if (profile.sexualOrientation !== undefined) {
    payload.sexual_orientation = profile.sexualOrientation;
  }
  if (profile.lookingFor !== undefined) {
    payload.looking_for = profile.lookingFor;
  }
  if (profile.queerRoles !== undefined) {
    payload.queer_roles = profile.queerRoles;
  }
  if (profile.presentationTags !== undefined) {
    payload.presentation_tags = profile.presentationTags;
  }
  if (profile.personalityTags !== undefined) {
    payload.personality_tags = profile.personalityTags;
  }
  if (profile.lifestyleTags !== undefined) {
    payload.lifestyle_tags = profile.lifestyleTags;
  }
  if (profile.verificationStatus !== undefined) {
    payload.verification_status = profile.verificationStatus;
  }

  return payload;
}

function buildPreferencesUpdatePayload(
  preferences: Partial<DatingPreferences>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (preferences.ageRangeMin !== undefined) {
    payload.age_range_min = preferences.ageRangeMin;
  }
  if (preferences.ageRangeMax !== undefined) {
    payload.age_range_max = preferences.ageRangeMax;
  }
  if (preferences.heightMinInches !== undefined) {
    payload.height_min_inches = preferences.heightMinInches;
  }
  if (preferences.heightMaxInches !== undefined) {
    payload.height_max_inches = preferences.heightMaxInches;
  }
  if (preferences.maxDistanceMiles !== undefined) {
    payload.max_distance_miles = preferences.maxDistanceMiles;
  }
  if (preferences.preferredOrientations !== undefined) {
    payload.preferred_orientations = preferences.preferredOrientations;
  }
  if (preferences.preferredLookingFor !== undefined) {
    payload.preferred_looking_for = preferences.preferredLookingFor;
  }
  if (preferences.preferredQueerRoles !== undefined) {
    payload.preferred_queer_roles = preferences.preferredQueerRoles;
  }
  if (preferences.preferredPresentationTags !== undefined) {
    payload.preferred_presentation_tags = preferences.preferredPresentationTags;
  }
  if (preferences.dealbreakers !== undefined) {
    payload.dealbreakers = preferences.dealbreakers;
  }
  if (preferences.niceToHaves !== undefined) {
    payload.nice_to_haves = preferences.niceToHaves;
  }

  return payload;
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const client = requireSupabase();
  const profileOp = 'profiles.select';

  logSupabaseRequest(profileOp, { userId });

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    throwSupabaseError(profileOp, profileError);
  }
  if (!profile) {
    console.log('[SpeedSpark Supabase] ✓ profiles.select (no row yet)', { userId });
    return null;
  }

  console.log('[SpeedSpark Supabase] ✓ profiles.select', { userId });
  return mapProfileRow(profile as ProfileRow, []);
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

/** Saves profile fields without marking onboarding complete. */
export async function saveProfileFields(
  userId: string,
  profile: Partial<UserProfile>,
  names?: ProfileNameFields,
): Promise<UserProfile> {
  const client = requireSupabase();
  const op = 'profiles.update';
  const payload = buildProfileUpdatePayload(profile, names);

  logSupabaseRequest(op, { userId, fields: Object.keys(payload) });

  const { data, error } = await client
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    throwSupabaseError(op, error);
  }

  console.log('[SpeedSpark Supabase] ✓ profiles.update', { userId });
  return mapProfileRow(data as ProfileRow, profile.photos ?? []);
}

/** Saves dating preference fields. */
export async function savePreferencesFields(
  userId: string,
  preferences: Partial<DatingPreferences>,
): Promise<Partial<DatingPreferences>> {
  const client = requireSupabase();
  const op = 'dating_preferences.update';
  const payload = buildPreferencesUpdatePayload(preferences);

  logSupabaseRequest(op, { userId, fields: Object.keys(payload) });

  const { data, error } = await client
    .from('dating_preferences')
    .update(payload)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throwSupabaseError(op, error);
  }

  console.log('[SpeedSpark Supabase] ✓ dating_preferences.update', { userId });
  return mapPreferencesRow(data as DatingPreferencesRow);
}

/** Marks onboarding finished (user may enter the lobby). */
export async function markOnboardingComplete(userId: string): Promise<void> {
  const op = 'profiles.markOnboarded';
  logSupabaseRequest(op, { userId });

  const { error } = await requireSupabase()
    .from('profiles')
    .update({
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throwSupabaseError(op, error);
  }

  console.log('[SpeedSpark Supabase] ✓ profiles.markOnboarded', { userId });
}

/** Final onboarding save: profile + preferences + onboarded_at. */
export async function upsertProfile(
  userId: string,
  profile: Partial<UserProfile>,
  names?: ProfileNameFields,
): Promise<UserProfile> {
  const saved = await saveProfileFields(userId, profile, names);
  await markOnboardingComplete(userId);
  return saved;
}

export async function upsertPreferences(
  userId: string,
  preferences: Partial<DatingPreferences>,
): Promise<Partial<DatingPreferences>> {
  return savePreferencesFields(userId, preferences);
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
