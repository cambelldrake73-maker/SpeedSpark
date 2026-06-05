import { normalizeMatchingPriorityOrder } from '../constants/matchingPriorities';
import type {
  DatingPreferences,
  GenderIdentity,
  LookingFor,
  MatchingPriorityCategory,
  PresentationTag,
  QueerRole,
  SexualOrientation,
  UserProfile,
  VerificationStatus,
} from '../types';
import type { DatingPreferencesRow, ProfileRow } from '../types/database';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { isDbAvailable, resolveDbClient } from './dbClient';
import { fetchProfilePhotoUrls } from './profilePhotos';

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
    matchingPriorityOrder: normalizeMatchingPriorityOrder(
      row.matching_priority_order as MatchingPriorityCategory[] | undefined,
    ),
  };
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!isDbAvailable()) {
    return null;
  }

  const profileOp = 'profiles.select';
  logSupabaseRequest(profileOp, { userId });

  const { data: profile, error: profileError } = await resolveDbClient()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    throwSupabaseError(profileOp, profileError);
  }
  if (!profile) {
    return null;
  }

  const photos = await fetchProfilePhotoUrls(userId);
  return mapProfileRow(profile as ProfileRow, photos);
}

export async function fetchPreferences(userId: string): Promise<Partial<DatingPreferences> | null> {
  if (!isDbAvailable()) {
    return null;
  }

  const op = 'dating_preferences.select';
  logSupabaseRequest(op, { userId });

  const { data, error } = await resolveDbClient()
    .from('dating_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throwSupabaseError(op, error);
  }
  if (!data) {
    return null;
  }

  return mapPreferencesRow(data as DatingPreferencesRow);
}
