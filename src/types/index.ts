export type GenderIdentity =
  | 'woman'
  | 'man'
  | 'non_binary'
  | 'genderqueer'
  | 'trans_woman'
  | 'trans_man'
  | 'questioning'
  | 'other'
  | 'prefer_not_to_say';

export type SexualOrientation =
  | 'lesbian'
  | 'gay'
  | 'bisexual'
  | 'pansexual'
  | 'queer'
  | 'asexual'
  | 'demisexual'
  | 'questioning'
  | 'other'
  | 'prefer_not_to_say';

export type LookingFor =
  | 'dates'
  | 'relationship'
  | 'friends'
  | 'casual'
  | 'unsure';

export type QueerRole =
  | 'top'
  | 'bottom'
  | 'verse'
  | 'side'
  | 'no_label'
  | 'prefer_not_to_say';

export type PresentationTag =
  | 'masc'
  | 'fem'
  | 'no_label'
  | 'prefer_not_to_say';

/** @deprecated Use queerRoles + presentationTags */
export type QueerPreference = QueerRole | PresentationTag;

export type VerificationStatus = 'unverified' | 'pending' | 'verified';

export type ContactVerificationMethod = 'phone' | 'email';

export interface AccountSignup {
  firstName: string;
  lastName: string;
  age: number;
  email: string;
  phone: string;
  verificationMethod: ContactVerificationMethod;
  contactVerified: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  location: string;
  locationLatitude?: number;
  locationLongitude?: number;
  heightInches: number;
  photos: string[];
  genderIdentity: GenderIdentity;
  sexualOrientation: SexualOrientation;
  lookingFor: LookingFor[];
  queerRoles: QueerRole[];
  presentationTags: PresentationTag[];
  personalityTags: string[];
  lifestyleTags: string[];
  verificationStatus: VerificationStatus;
  /** Private internal match-fit signal — never shown to users */
  internalMatchFit?: number;
}

export interface DatingPreferences {
  ageRangeMin: number;
  ageRangeMax: number;
  heightMinInches: number;
  heightMaxInches: number;
  maxDistanceMiles: number;
  preferredOrientations: SexualOrientation[];
  preferredLookingFor: LookingFor[];
  preferredQueerRoles: QueerRole[];
  preferredPresentationTags: PresentationTag[];
  dealbreakers: string[];
  niceToHaves: string[];
}

export interface SpeedDateWindow {
  id: string;
  label: string;
  description: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isLive: boolean;
  queueCount?: number;
}

export interface SpeedDateMatch {
  id: string;
  partner: UserProfile;
  scheduledAt: string;
}

/** Private post-date feedback — never shown publicly */
export interface DateFeedback {
  dateId: string;
  partnerId: string;
  attractivenessRating: number;
  /** Whether the user chose to match — independent of attractiveness rating */
  wouldTalkAgain: boolean;
}

export interface Match {
  id: string;
  user: UserProfile;
  matchedAt: string;
  lastMessage?: string;
  lastMessageAt?: string;
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  text: string;
  sentAt: string;
}

export interface BlockedUser {
  userId: string;
  name: string;
  blockedAt: string;
}

export interface OnboardingData {
  profile: Partial<UserProfile>;
  preferences: Partial<DatingPreferences>;
  account?: AccountSignup;
}
