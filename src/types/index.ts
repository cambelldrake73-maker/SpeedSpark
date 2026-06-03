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

export type QueerPreference =
  | 'top'
  | 'bottom'
  | 'verse'
  | 'side'
  | 'masc'
  | 'fem'
  | 'no_label'
  | 'prefer_not_to_say';

export type VerificationStatus = 'unverified' | 'pending' | 'verified';

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  location: string;
  heightInches: number;
  photos: string[];
  genderIdentity: GenderIdentity;
  sexualOrientation: SexualOrientation;
  lookingFor: LookingFor[];
  queerPreferences: QueerPreference[];
  personalityTags: string[];
  verificationStatus: VerificationStatus;
  /** Private matching signal — never shown publicly */
  attractivenessRating?: number;
}

export interface DatingPreferences {
  ageRangeMin: number;
  ageRangeMax: number;
  heightMinInches: number;
  heightMaxInches: number;
  maxDistanceMiles: number;
  preferredOrientations: SexualOrientation[];
  preferredLookingFor: LookingFor[];
  preferredQueerPreferences: QueerPreference[];
}

export interface SpeedDateWindow {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isLive: boolean;
}

export interface SpeedDateMatch {
  id: string;
  partner: UserProfile;
  scheduledAt: string;
}

export interface DateFeedback {
  dateId: string;
  partnerId: string;
  feltSafe: boolean;
  goodConversation: boolean;
  wouldTalkAgain: boolean;
  vibeRating: number;
  notes?: string;
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

export interface OnboardingData {
  profile: Partial<UserProfile>;
  preferences: Partial<DatingPreferences>;
}
