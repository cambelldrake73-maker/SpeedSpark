import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type {
  DateFeedback,
  DatingPreferences,
  OnboardingData,
  UserProfile,
} from '../types';
import { MOCK_CURRENT_USER, MOCK_PARTNER } from '../data/mockUsers';

interface AppContextValue {
  currentUser: UserProfile;
  onboarding: OnboardingData;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updatePreferences: (updates: Partial<DatingPreferences>) => void;
  completeOnboarding: () => void;
  isOnboarded: boolean;
  currentDatePartner: UserProfile | null;
  setCurrentDatePartner: (partner: UserProfile | null) => void;
  lastFeedback: DateFeedback | null;
  setLastFeedback: (feedback: DateFeedback | null) => void;
  partnerFeedback: DateFeedback | null;
  setPartnerFeedback: (feedback: DateFeedback | null) => void;
  isLoggedIn: boolean;
  login: () => void;
  logout: () => void;
}

const defaultPreferences: Partial<DatingPreferences> = {
  ageRangeMin: 21,
  ageRangeMax: 40,
  heightMinInches: 60,
  heightMaxInches: 78,
  maxDistanceMiles: 25,
  preferredOrientations: [],
  preferredLookingFor: [],
  preferredQueerPreferences: [],
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(MOCK_CURRENT_USER);
  const [onboarding, setOnboarding] = useState<OnboardingData>({
    profile: { ...MOCK_CURRENT_USER },
    preferences: { ...defaultPreferences },
  });
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentDatePartner, setCurrentDatePartner] = useState<UserProfile | null>(null);
  const [lastFeedback, setLastFeedback] = useState<DateFeedback | null>(null);
  const [partnerFeedback, setPartnerFeedback] = useState<DateFeedback | null>(null);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setOnboarding((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...updates },
    }));
  }, []);

  const updatePreferences = useCallback((updates: Partial<DatingPreferences>) => {
    setOnboarding((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, ...updates },
    }));
  }, []);

  const completeOnboarding = useCallback(() => {
    const profile = onboarding.profile as UserProfile;
    setCurrentUser({
      ...profile,
      id: 'user-1',
      verificationStatus: 'pending',
    });
    setIsOnboarded(true);
  }, [onboarding]);

  const login = useCallback(() => {
    setIsLoggedIn(true);
    setIsOnboarded(true);
    setCurrentUser({
      ...MOCK_CURRENT_USER,
      id: 'user-1',
      name: 'You',
      age: 27,
      location: 'Brooklyn, NY',
      heightInches: 66,
      genderIdentity: 'non_binary',
      sexualOrientation: 'queer',
      lookingFor: ['dates', 'relationship'],
      queerPreferences: ['verse'],
      personalityTags: ['Creative', 'Chill'],
      verificationStatus: 'verified',
    });
  }, []);

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    setIsOnboarded(false);
    setCurrentUser(MOCK_CURRENT_USER);
    setCurrentDatePartner(null);
    setLastFeedback(null);
    setPartnerFeedback(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        onboarding,
        updateProfile,
        updatePreferences,
        completeOnboarding,
        isOnboarded,
        currentDatePartner,
        setCurrentDatePartner,
        lastFeedback,
        setLastFeedback,
        partnerFeedback,
        setPartnerFeedback,
        isLoggedIn,
        login,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

/** Simulates partner feedback for MVP demo */
export function simulatePartnerFeedback(dateId: string, partnerId: string): DateFeedback {
  return {
    dateId,
    partnerId,
    feltSafe: true,
    goodConversation: true,
    wouldTalkAgain: true,
    vibeRating: 4,
  };
}

export { MOCK_PARTNER };
