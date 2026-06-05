import type { DatingPreferences, UserProfile } from '../types';
import type { MatchCandidate } from '../types/matchingBackend';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { resolveDbClient } from './dbClient';
import { logBackendInfo } from './backendLogger';
import type { MatchingContext } from './matchingService';

interface WindowMatchingContextRpc {
  windowId: string;
  entries: Array<{
    queueEntryId: string;
    userId: string;
    joinedAt: string;
    profile: UserProfile;
    preferences: Partial<DatingPreferences>;
  }>;
  blockedEdges: Array<{ blockerId: string; blockedId: string }>;
  reportedPairKeys: string[];
  recentPairKeys: string[];
  appearanceScores: Array<{ viewerId: string; partnerId: string; score: number }>;
}

function pairKey(userAId: string, userBId: string): string {
  return [userAId, userBId].sort().join(':');
}

export async function loadWindowMatchingBundle(windowId: string): Promise<{
  candidates: MatchCandidate[];
  matchingContext: MatchingContext;
  blockedByUser: Map<string, Set<string>>;
}> {
  const op = 'rpc.get_window_matching_context';
  logSupabaseRequest(op, { windowId });

  const { data, error } = await resolveDbClient().rpc('get_window_matching_context', {
    p_window_id: windowId,
  });

  if (error) {
    throwSupabaseError(op, error);
  }

  const bundle = data as WindowMatchingContextRpc;

  const candidates: MatchCandidate[] = (bundle.entries ?? []).map((entry) => ({
    userId: entry.userId,
    queueEntryId: entry.queueEntryId,
    joinedAt: entry.joinedAt,
    profile: entry.profile,
    preferences: entry.preferences ?? {},
  }));

  const blockedByUser = new Map<string, Set<string>>();
  for (const edge of bundle.blockedEdges ?? []) {
    if (!blockedByUser.has(edge.blockerId)) {
      blockedByUser.set(edge.blockerId, new Set());
    }
    blockedByUser.get(edge.blockerId)!.add(edge.blockedId);
  }

  const appearanceScoresByViewer = new Map<string, Map<string, number>>();
  for (const row of bundle.appearanceScores ?? []) {
    if (!appearanceScoresByViewer.has(row.viewerId)) {
      appearanceScoresByViewer.set(row.viewerId, new Map());
    }
    appearanceScoresByViewer.get(row.viewerId)!.set(row.partnerId, row.score);
  }

  const matchingContext: MatchingContext = {
    recentPairKeys: new Set(bundle.recentPairKeys ?? []),
    reportedPairKeys: new Set(bundle.reportedPairKeys ?? []),
    appearanceScoresByViewer,
  };

  logBackendInfo('matchingData.serverBundle', {
    windowId,
    candidates: candidates.length,
    blockedEdges: bundle.blockedEdges?.length ?? 0,
    reportedPairs: bundle.reportedPairKeys?.length ?? 0,
    recentPairs: bundle.recentPairKeys?.length ?? 0,
    appearanceRows: bundle.appearanceScores?.length ?? 0,
  });

  return { candidates, matchingContext, blockedByUser };
}

export type WindowMatchingBundle = Awaited<ReturnType<typeof loadWindowMatchingBundle>>;

export async function cleanupStaleQueueEntries(windowId: string): Promise<{
  pairedSynced: number;
  markedLeft: number;
  staleRemoved: number;
}> {
  const op = 'rpc.cleanup_stale_queue_entries';
  logSupabaseRequest(op, { windowId });

  const { data, error } = await resolveDbClient().rpc('cleanup_stale_queue_entries', {
    p_window_id: windowId,
  });

  if (error) {
    throwSupabaseError(op, error);
  }

  const result = (data ?? {}) as {
    pairedSynced?: number;
    markedLeft?: number;
    staleRemoved?: number;
  };

  logBackendInfo('pairing.queueCleanup', { windowId, ...result });
  return {
    pairedSynced: result.pairedSynced ?? 0,
    markedLeft: result.markedLeft ?? 0,
    staleRemoved: result.staleRemoved ?? 0,
  };
}

export function blockedIdsForUser(
  blockedByUser: Map<string, Set<string>>,
  userId: string,
  candidateIds: string[],
): Set<string> {
  const ids = new Set<string>();
  const blocked = blockedByUser.get(userId);
  if (blocked) {
    for (const id of blocked) {
      ids.add(id);
    }
  }
  for (const otherId of candidateIds) {
    if (otherId === userId) {
      continue;
    }
    const reverse = blockedByUser.get(otherId);
    if (reverse?.has(userId)) {
      ids.add(otherId);
    }
  }
  return ids;
}

export { pairKey };
