import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { UserProfile, DateFeedback } from '../types';

export type RootStackParamList = {
  Welcome: undefined;
  Auth: undefined;
  ProfileCreation: undefined;
  Preferences: undefined;
  Verification: undefined;
  SpeedDateLobby: undefined;
  ActiveDate: { partner: UserProfile };
  PostDateFeedback: { partnerId: string; dateId: string };
  MatchResult: { partnerId: string; dateId: string };
  Messages: { matchId?: string };
};

export type WelcomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Welcome'>;
export type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Auth'>;
export type ProfileCreationScreenProps = NativeStackScreenProps<RootStackParamList, 'ProfileCreation'>;
export type PreferencesScreenProps = NativeStackScreenProps<RootStackParamList, 'Preferences'>;
export type VerificationScreenProps = NativeStackScreenProps<RootStackParamList, 'Verification'>;
export type SpeedDateLobbyScreenProps = NativeStackScreenProps<RootStackParamList, 'SpeedDateLobby'>;
export type ActiveDateScreenProps = NativeStackScreenProps<RootStackParamList, 'ActiveDate'>;
export type PostDateFeedbackScreenProps = NativeStackScreenProps<RootStackParamList, 'PostDateFeedback'>;
export type MatchResultScreenProps = NativeStackScreenProps<RootStackParamList, 'MatchResult'>;
export type MessagesScreenProps = NativeStackScreenProps<RootStackParamList, 'Messages'>;

export type { UserProfile, DateFeedback };
