import type { DatingPreferences, UserProfile } from '../types';
import type { MatchCandidate } from '../types/matchingBackend';
import { fetchPreferences, fetchProfile } from './profiles';
import { getWaitingQueueEntries } from './queueService';
import { logBackendInfo } from './backendLogger';
import { fetchBlockedUserIds } from './blocks';

export async function loadMatchCandidates(windowId: string): Promise<MatchCandidate[]> {
  const entries = await getWaitingQueueEntries(windowId);
  const userIds = entries.map((e) => e.userId);

  if (userIds.length === 0) {
    return [];
  }

  const blockedSets = await Promise.all(
    userIds.map(async (userId) => ({
      userId,
      blocked: await fetchBlockedUserIds(userId),
    })),
  );
  const blockedByUser = new Map(blockedSets.map((b) => [b.userId, b.blocked]));

  const candidates: MatchCandidate[] = [];

  for (const entry of entries) {
    const [profile, preferences] = await Promise.all([
      fetchProfile(entry.userId),
      fetchPreferences(entry.userId),
    ]);

    if (!profile) {
      logBackendInfo('matchingData.skipNoProfile', { userId: entry.userId });
      continue;
    }

    candidates.push({
      userId: entry.userId,
      queueEntryId: entry.id,
      joinedAt: entry.joinedAt,
      profile,
      preferences: preferences ?? {},
    });
  }

  logBackendInfo('matchingData.loaded', {
    windowId,
    waiting: entries.length,
    candidates: candidates.length,
    blockedUsersTracked: blockedByUser.size,
  });

  return candidates;
}

export async function loadUserMatchingContext(userId: string): Promise<{
  profile: UserProfile | null;
  preferences: Partial<DatingPreferences>;
  blockedIds: Set<string>;
}> {
  const [profile, preferences, blockedIds] = await Promise.all([
    fetchProfile(userId),
    fetchPreferences(userId),
    fetchBlockedUserIds(userId),
  ]);

  return {
    profile,
    preferences: preferences ?? {},
    blockedIds,
  };
}
