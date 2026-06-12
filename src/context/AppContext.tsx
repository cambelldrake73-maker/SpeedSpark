import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type {
  AccountSignup,
  BlockedUser,
  DateFeedback,
  DatingPreferences,
  Match,
  Message,
  OnboardingData,
  UserProfile,
} from '../types';
import { MOCK_CURRENT_USER, MOCK_PARTNER } from '../data/mockUsers';
import {
  blockUserWithSafety,
  fetchBlockedUsers,
  fetchPreferences,
  fetchProfile,
  isParticipationAllowedStatus,
  isSupabaseConfigured,
  markOnboardingComplete,
  requestAccountDeletion,
  requireSupabase,
  savePreferencesFields,
  saveProfileFields,
  unblockUserInSupabase,
  updateTextNotificationsEnabled,
} from '../services';
import type { BlockUserOptions, AccountStatus } from '../types/safety';
import { DEFAULT_MATCHING_PRIORITY_ORDER } from '../constants/matchingPriorities';
import {
  isPreferencesComplete,
  isProfileComplete,
  isReturningAccountReady,
  resolveOnboardingRoute,
  type OnboardingRoute,
} from '../utils/onboardingStatus';
import { formatAuthErrorForUser } from '../utils/authErrors';
import {
  logSupabaseError,
  logSupabaseRequest,
  throwSupabaseError,
} from '../utils/supabaseDebug';

interface AppContextValue {
  currentUser: UserProfile;
  preferences: Partial<DatingPreferences>;
  onboarding: OnboardingData;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateCurrentUser: (updates: Partial<UserProfile>) => void;
  updatePreferences: (updates: Partial<DatingPreferences>) => void;
  updateAccount: (updates: Partial<AccountSignup>) => void;
  markContactVerified: () => void;
  windowIdentityVerified: boolean;
  verifyForWindow: () => void;
  resetWindowVerification: () => void;
  completeOnboarding: () => Promise<void>;
  isOnboarded: boolean;
  currentDatePartner: UserProfile | null;
  setCurrentDatePartner: (partner: UserProfile | null) => void;
  lastFeedback: DateFeedback | null;
  setLastFeedback: (feedback: DateFeedback | null) => void;
  partnerFeedback: DateFeedback | null;
  setPartnerFeedback: (feedback: DateFeedback | null) => void;
  isLoggedIn: boolean;
  markLoggedIn: () => void;
  login: () => void;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  syncFromSupabase: (userId: string) => Promise<SyncFromSupabaseResult>;
  saveProfileToServer: (profile: Partial<UserProfile>) => Promise<UserProfile>;
  savePreferencesToServer: (prefs: Partial<DatingPreferences>) => Promise<Partial<DatingPreferences>>;
  isHydrating: boolean;
  hydrationError: string | null;
  clearHydrationError: () => void;
  textNotificationsEnabled: boolean;
  setTextNotificationsEnabled: (enabled: boolean) => void;
  blockedUsers: BlockedUser[];
  blockUser: (user: Pick<UserProfile, 'id' | 'name'>, options?: BlockUserOptions) => void;
  unblockUser: (userId: string) => void;
  isBlocked: (userId: string) => boolean;
  demoMatches: Match[];
  demoMessagesByMatch: Record<string, Message[]>;
  registerDemoMatch: (partner: UserProfile) => string;
  removeDemoMatch: (matchId: string) => void;
  sendDemoMessage: (matchId: string, message: Message) => void;
}

const defaultPreferences: Partial<DatingPreferences> = {
  ageRangeMin: 21,
  ageRangeMax: 40,
  heightMinInches: 60,
  heightMaxInches: 84,
  maxDistanceMiles: 25,
  preferredOrientations: [],
  preferredLookingFor: [],
  preferredQueerRoles: [],
  preferredPresentationTags: [],
  matchingPriorityOrder: [...DEFAULT_MATCHING_PRIORITY_ORDER],
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export interface SyncFromSupabaseResult {
  onboarded: boolean;
  profileComplete: boolean;
  preferencesComplete: boolean;
  nextRoute: OnboardingRoute;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(MOCK_CURRENT_USER);
  const [preferences, setPreferences] =
    useState<Partial<DatingPreferences>>(defaultPreferences);
  const [onboarding, setOnboarding] = useState<OnboardingData>({
    profile: { ...MOCK_CURRENT_USER },
    preferences: { ...defaultPreferences },
  });
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentDatePartner, setCurrentDatePartner] = useState<UserProfile | null>(null);
  const [lastFeedback, setLastFeedback] = useState<DateFeedback | null>(null);
  const [partnerFeedback, setPartnerFeedback] = useState<DateFeedback | null>(null);
  const [windowIdentityVerified, setWindowIdentityVerified] = useState(false);
  const [textNotificationsEnabled, setTextNotificationsEnabledState] = useState(true);

  const setTextNotificationsEnabled = useCallback(
    (enabled: boolean) => {
      setTextNotificationsEnabledState(enabled);
      const userId = currentUser.id;
      if (!isSupabaseConfigured || !userId || userId === 'user-1') {
        return;
      }
      void updateTextNotificationsEnabled(userId, enabled).catch((error) => {
        console.warn('[SpeedSpark] Failed to save text notification preference', error);
      });
    },
    [currentUser.id],
  );
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [demoMatches, setDemoMatches] = useState<Match[]>([]);
  const [demoMessagesByMatch, setDemoMessagesByMatch] = useState<Record<string, Message[]>>({});
  const [isHydrating, setIsHydrating] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  const clearHydrationError = useCallback(() => {
    setHydrationError(null);
  }, []);

  const verifyForWindow = useCallback(() => {
    setWindowIdentityVerified(true);
    setCurrentUser((prev) => ({ ...prev, verificationStatus: 'verified' }));
  }, []);

  const resetWindowVerification = useCallback(() => {
    setWindowIdentityVerified(false);
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setOnboarding((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...updates },
    }));
  }, []);

  const updateCurrentUser = useCallback((updates: Partial<UserProfile>) => {
    setCurrentUser((prev) => ({ ...prev, ...updates }));
    setOnboarding((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...updates },
    }));
  }, []);

  const updatePreferences = useCallback((updates: Partial<DatingPreferences>) => {
    setOnboarding((prev) => {
      const nextPrefs = { ...prev.preferences, ...updates };
      setPreferences(nextPrefs);
      return { ...prev, preferences: nextPrefs };
    });
  }, []);

  const updateAccount = useCallback((updates: Partial<AccountSignup>) => {
    setOnboarding((prev) => {
      const base: AccountSignup = prev.account ?? {
        firstName: '',
        lastName: '',
        age: 0,
        email: '',
        phone: '',
        verificationMethod: 'phone',
        contactVerified: false,
      };
      return {
        ...prev,
        account: { ...base, ...updates },
      };
    });
  }, []);

  const markContactVerified = useCallback(() => {
    setOnboarding((prev) => ({
      ...prev,
      account: prev.account ? { ...prev.account, contactVerified: true } : prev.account,
    }));
  }, []);

  const completeOnboarding = useCallback(async () => {
    const profile = onboarding.profile as UserProfile;
    const nextPreferences = onboarding.preferences;

    if (isSupabaseConfigured && profile.id && profile.id !== 'user-1') {
      const names = onboarding.account
        ? {
            firstName: onboarding.account.firstName,
            lastName: onboarding.account.lastName,
          }
        : undefined;
      const savedProfile = await saveProfileFields(profile.id, profile, names);
      const savedPrefs = await savePreferencesFields(profile.id, nextPreferences);
      await markOnboardingComplete(profile.id);
      setCurrentUser(savedProfile);
      setPreferences(savedPrefs);
    } else {
      setCurrentUser({
        ...profile,
        id: profile.id || 'user-1',
        verificationStatus: profile.verificationStatus ?? 'pending',
      });
      setPreferences(nextPreferences);
    }

    setIsOnboarded(true);
    setIsLoggedIn(true);
    setWindowIdentityVerified(false);
  }, [onboarding]);

  const saveProfileToServer = useCallback(
    async (profile: Partial<UserProfile>) => {
      const userId = profile.id ?? onboarding.profile.id;
      if (!isSupabaseConfigured || !userId || userId === 'user-1') {
        updateProfile(profile);
        return { ...onboarding.profile, ...profile } as UserProfile;
      }

      const names = onboarding.account
        ? {
            firstName: onboarding.account.firstName,
            lastName: onboarding.account.lastName,
          }
        : undefined;
      const saved = await saveProfileFields(userId, profile, names);
      setCurrentUser(saved);
      setOnboarding((prev) => ({ ...prev, profile: saved }));
      return saved;
    },
    [onboarding.account, onboarding.profile.id, updateProfile],
  );

  const savePreferencesToServer = useCallback(
    async (prefs: Partial<DatingPreferences>) => {
      const userId = currentUser.id || onboarding.profile.id;
      if (!isSupabaseConfigured || !userId || userId === 'user-1') {
        updatePreferences(prefs);
        return { ...preferences, ...prefs };
      }

      const saved = await savePreferencesFields(userId, prefs);
      setPreferences(saved);
      setOnboarding((prev) => ({ ...prev, preferences: saved }));

      if (prefs.preferredLookingFor !== undefined) {
        const profileSaved = await saveProfileFields(userId, {
          interestedInGenders: prefs.preferredLookingFor,
        });
        setCurrentUser(profileSaved);
        setOnboarding((prev) => ({ ...prev, profile: profileSaved }));
      }

      return saved;
    },
    [currentUser.id, onboarding.profile.id, preferences, updatePreferences],
  );

  const markLoggedIn = useCallback(() => {
    setIsLoggedIn(true);
  }, []);

  const syncFromSupabase = useCallback(async (userId: string): Promise<SyncFromSupabaseResult> => {
    const op = 'app.syncFromSupabase';
    logSupabaseRequest(op, { userId });
    setIsHydrating(true);
    setHydrationError(null);

    try {
      const profile = await fetchProfile(userId);
      if (profile) {
        setCurrentUser(profile);
        setOnboarding((prev) => ({ ...prev, profile }));
      }

      const prefs = await fetchPreferences(userId);
      const mergedPrefs = prefs ?? defaultPreferences;
      if (prefs) {
        setPreferences(prefs);
        setOnboarding((prev) => ({ ...prev, preferences: prefs }));
      }

      const blocked = await fetchBlockedUsers(userId);
      setBlockedUsers(blocked);

      const statusOp = 'profiles.selectOnboardedStatus';
      logSupabaseRequest(statusOp, { userId });
      const { data: profileRow, error: statusError } = await requireSupabase()
        .from('profiles')
        .select('onboarded_at, text_notifications_enabled, account_status')
        .eq('id', userId)
        .maybeSingle();

      if (statusError) {
        throwSupabaseError(statusOp, statusError);
      }

      const accountStatus =
        ((profileRow as { account_status?: AccountStatus } | null)?.account_status ??
          'active') as AccountStatus;
      if (!isParticipationAllowedStatus(accountStatus)) {
        throw new Error('This account is no longer active. Contact support if you need help.');
      }

      let onboarded = Boolean(
        (profileRow as { onboarded_at?: string | null } | null)?.onboarded_at,
      );
      const activeProfile = profile ?? onboarding.profile;
      const profileComplete = isProfileComplete(activeProfile);
      const preferencesComplete = isPreferencesComplete(mergedPrefs);
      const returningReady = isReturningAccountReady(activeProfile, mergedPrefs);

      if (!onboarded && returningReady) {
        await markOnboardingComplete(userId);
        onboarded = true;
      }

      const nextRoute = resolveOnboardingRoute({
        isOnboarded: onboarded,
        profile: activeProfile,
        preferences: mergedPrefs,
      });

      setIsOnboarded(onboarded);
      setIsLoggedIn(true);
      setTextNotificationsEnabledState(
        (profileRow as { text_notifications_enabled?: boolean } | null)
          ?.text_notifications_enabled ?? true,
      );

      console.log('[SpeedSpark Supabase] ✓ app.syncFromSupabase', {
        userId,
        onboarded,
        profileComplete,
        preferencesComplete,
        nextRoute,
      });

      return { onboarded, profileComplete, preferencesComplete, nextRoute };
    } catch (error) {
      logSupabaseError(op, error);
      setHydrationError(formatAuthErrorForUser(error));
      throw error;
    } finally {
      setIsHydrating(false);
    }
  }, [onboarding.profile]);

  // Demo fast-path login when not using Supabase email auth
  const login = useCallback(() => {
    setIsLoggedIn(true);
    setIsOnboarded(true);
    setWindowIdentityVerified(false);
    setCurrentUser({
      ...MOCK_CURRENT_USER,
      id: 'user-1',
      name: 'Riley',
      age: 27,
      location: 'Brooklyn, NY',
      locationLatitude: 40.6782,
      locationLongitude: -73.9442,
      heightInches: 66,
      genderIdentity: 'non_binary',
      sexualOrientation: 'queer',
      datingIntentions: ['dates', 'relationship'],
      interestedInGenders: ['non_binary', 'woman', 'man'],
      queerRoles: ['verse'],
      presentationTags: [],
      personalityTags: [],
      lifestyleTags: ['Monogamous', 'Creative', 'Thoughtful', 'Chill', 'Romantic'],
      verificationStatus: 'verified',
    });
    setPreferences({
      ...defaultPreferences,
      preferredLookingFor: ['non_binary', 'woman', 'man'],
      preferredQueerRoles: ['verse', 'side'],
    });
  }, []);

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    setIsOnboarded(false);
    setCurrentUser(MOCK_CURRENT_USER);
    setPreferences(defaultPreferences);
    setOnboarding({ profile: { ...MOCK_CURRENT_USER }, preferences: { ...defaultPreferences } });
    setCurrentDatePartner(null);
    setLastFeedback(null);
    setPartnerFeedback(null);
    setWindowIdentityVerified(false);
    setTextNotificationsEnabledState(true);
    setBlockedUsers([]);
    setDemoMatches([]);
    setDemoMessagesByMatch({});
  }, []);

  const deleteAccount = useCallback(async () => {
    if (isSupabaseConfigured && currentUser.id && currentUser.id !== 'user-1') {
      await requestAccountDeletion();
    }
    logout();
  }, [logout, currentUser.id]);

  const blockUser = useCallback(
    (user: Pick<UserProfile, 'id' | 'name'>, options?: BlockUserOptions) => {
      setBlockedUsers((prev) => {
        if (prev.some((entry) => entry.userId === user.id)) {
          return prev;
        }
        return [
          ...prev,
          {
            userId: user.id,
            name: user.name,
            blockedAt: new Date().toISOString(),
          },
        ];
      });

      if (isSupabaseConfigured && currentUser.id && currentUser.id !== 'user-1') {
        void blockUserWithSafety(currentUser.id, user.id, {
          speedDateId: options?.speedDateId,
        }).catch((error) => {
          logSupabaseError('blockUserWithSafety', error);
        });
      }
    },
    [currentUser.id],
  );

  const unblockUser = useCallback((userId: string) => {
    setBlockedUsers((prev) => prev.filter((entry) => entry.userId !== userId));

    if (isSupabaseConfigured && currentUser.id && currentUser.id !== 'user-1') {
      void unblockUserInSupabase(currentUser.id, userId);
    }
  }, [currentUser.id]);

  const isBlocked = useCallback(
    (userId: string) => blockedUsers.some((entry) => entry.userId === userId),
    [blockedUsers],
  );

  const registerDemoMatch = useCallback((partner: UserProfile): string => {
    let matchId = '';
    setDemoMatches((prev) => {
      const existing = prev.find((match) => match.user.id === partner.id);
      if (existing) {
        matchId = existing.id;
        return prev;
      }
      matchId = `match-${partner.id}-${Date.now()}`;
      return [
        {
          id: matchId,
          user: partner,
          matchedAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
    setDemoMessagesByMatch((prev) => {
      if (matchId && prev[matchId] === undefined) {
        return { ...prev, [matchId]: [] };
      }
      return prev;
    });
    return matchId;
  }, []);

  const removeDemoMatch = useCallback((matchId: string) => {
    setDemoMatches((prev) => prev.filter((match) => match.id !== matchId));
    setDemoMessagesByMatch((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  }, []);

  const sendDemoMessage = useCallback((matchId: string, message: Message) => {
    setDemoMessagesByMatch((prev) => ({
      ...prev,
      [matchId]: [...(prev[matchId] ?? []), message],
    }));
    setDemoMatches((prev) =>
      prev.map((match) =>
        match.id === matchId
          ? {
              ...match,
              lastMessage: message.text,
              lastMessageAt: message.sentAt,
            }
          : match,
      ),
    );
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        preferences,
        onboarding,
        updateProfile,
        updateCurrentUser,
        updatePreferences,
        updateAccount,
        markContactVerified,
        windowIdentityVerified,
        verifyForWindow,
        resetWindowVerification,
        completeOnboarding,
        isOnboarded,
        currentDatePartner,
        setCurrentDatePartner,
        lastFeedback,
        setLastFeedback,
        partnerFeedback,
        setPartnerFeedback,
        isLoggedIn,
        markLoggedIn,
        login,
        logout,
        deleteAccount,
        syncFromSupabase,
        saveProfileToServer,
        savePreferencesToServer,
        isHydrating,
        hydrationError,
        clearHydrationError,
        textNotificationsEnabled,
        setTextNotificationsEnabled,
        blockedUsers,
        blockUser,
        unblockUser,
        isBlocked,
        demoMatches,
        demoMessagesByMatch,
        registerDemoMatch,
        removeDemoMatch,
        sendDemoMessage,
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
    attractivenessRating: 8,
    wouldTalkAgain: true,
  };
}

export { MOCK_PARTNER };
