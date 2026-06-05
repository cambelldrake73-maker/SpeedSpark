import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LegalDocumentId } from '../constants/legalContent';
import type { UserProfile, DateFeedback } from '../types';

export type RootStackParamList = {
  Welcome: undefined;
  Auth: { initialMode?: 'signup' | 'login' };
  ContactVerification: {
    flow?: 'signup' | 'login';
    phone?: string;
    email?: string;
    verificationMethod?: 'phone' | 'email';
  };
  ProfileCreation: undefined;
  Preferences: { fromSettings?: boolean } | undefined;
  Verification: { context?: 'onboarding' | 'window' };
  SpeedDateLobby: undefined;
  Settings: undefined;
  ManageProfile: undefined;
  BlockedUsers: undefined;
  LegalDocument: { documentId: LegalDocumentId };
  DateQueue: undefined;
  ActiveDate: { partner: UserProfile; speedDateId?: string };
  PostDateFeedback: { partnerId: string; dateId: string };
  MatchResult: { partnerId: string; dateId: string };
  Messages: { matchId?: string };
};

export type WelcomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Welcome'>;
export type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Auth'>;
export type ContactVerificationScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ContactVerification'
>;
export type ProfileCreationScreenProps = NativeStackScreenProps<RootStackParamList, 'ProfileCreation'>;
export type PreferencesScreenProps = NativeStackScreenProps<RootStackParamList, 'Preferences'>;
export type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export type ManageProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'ManageProfile'>;
export type BlockedUsersScreenProps = NativeStackScreenProps<RootStackParamList, 'BlockedUsers'>;
export type LegalDocumentScreenProps = NativeStackScreenProps<RootStackParamList, 'LegalDocument'>;
export type VerificationScreenProps = NativeStackScreenProps<RootStackParamList, 'Verification'>;
export type SpeedDateLobbyScreenProps = NativeStackScreenProps<RootStackParamList, 'SpeedDateLobby'>;
export type DateQueueScreenProps = NativeStackScreenProps<RootStackParamList, 'DateQueue'>;
export type ActiveDateScreenProps = NativeStackScreenProps<RootStackParamList, 'ActiveDate'>;
export type PostDateFeedbackScreenProps = NativeStackScreenProps<RootStackParamList, 'PostDateFeedback'>;
export type MatchResultScreenProps = NativeStackScreenProps<RootStackParamList, 'MatchResult'>;
export type MessagesScreenProps = NativeStackScreenProps<RootStackParamList, 'Messages'>;

export type { UserProfile, DateFeedback };
