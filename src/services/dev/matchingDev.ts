/**
 * Development-only helpers for queue / matching / pairing.
 * Call from Metro console or temporary __DEV__ buttons — not for production UI.
 */
import { logBackendInfo } from '../backendLogger';
import { fetchBlockedUserIds } from '../blocksRead';
import { fetchAppearanceFitScores } from '../matchingAppearance';
import { loadUserMatchingContext } from '../matchingData';
import {
  evaluateCompatibility,
  scoreDirectionalFit,
  type MatchingContext,
} from '../matchingService';
import { fetchReportedPairKeys } from '../matchingSafety';
import { invokeServerPairing } from '../pairingRemote';
import { joinQueue, getQueueCounts, getWaitingQueueEntries } from '../queueService';
import { fetchRecentSpeedDatePairKeys } from '../speedDatesPairing';
import { fetchSpeedDateWindows, upsertSpeedDateWindow } from '../windows';
import { isSupabaseConfigured } from '../supabaseEnv';

export async function seedDevLiveWindow(): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase env vars required for dev seeding.');
  }

  const now = new Date();
  const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const id = `dev-window-${Date.now()}`;

  const window = await upsertSpeedDateWindow({
    id,
    label: 'Dev Live Window',
    description: 'Auto-seeded window for local queue testing',
    startTime: now.toISOString(),
    endTime: end.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    isLive: true,
  });

  logBackendInfo('dev.seedLiveWindow', { windowId: window.id });
  return window.id;
}

export async function simulateQueuePopulation(
  windowId: string,
  userIds: string[],
): Promise<void> {
  for (const userId of userIds) {
    await joinQueue(userId, windowId);
  }
  const counts = await getQueueCounts(windowId);
  logBackendInfo('dev.simulateQueuePopulation', { windowId, userIds, counts });
}

export async function runDevPairing(windowId: string) {
  const waiting = await getWaitingQueueEntries(windowId);
  logBackendInfo('dev.pairing.start', { windowId, waiting: waiting.length });
  const response = await invokeServerPairing({ windowId });
  if (!response.ok) {
    throw new Error(response.error ?? 'Server pairing invoke failed');
  }
  const run = response.runs?.find((entry) => entry.windowId === windowId) ?? response.runs?.[0];
  logBackendInfo('dev.pairing.done', {
    windowId,
    pairsCreated: run?.pairsCreated ?? response.totalPairsCreated ?? 0,
    response,
  });
  return {
    windowId,
    pairsCreated: run?.pairsCreated ?? 0,
    speedDateIds: [],
    unmatchedUserIds: [],
    skippedPairs: [],
  };
}

export async function printDevQueueReport(windowId: string) {
  const counts = await getQueueCounts(windowId);
  const waiting = await getWaitingQueueEntries(windowId);
  const windows = await fetchSpeedDateWindows();
  console.log('[SpeedSpark Dev] windows', windows);
  console.log('[SpeedSpark Dev] queue counts', counts);
  console.log('[SpeedSpark Dev] waiting entries', waiting);
}

export async function compareDevMatchScores(userAId: string, userBId: string) {
  const [ctxA, ctxB, blockedA, blockedB, recentPairKeys, reportedPairKeys] = await Promise.all([
    loadUserMatchingContext(userAId),
    loadUserMatchingContext(userBId),
    fetchBlockedUserIds(userAId),
    fetchBlockedUserIds(userBId),
    fetchRecentSpeedDatePairKeys([userAId, userBId]),
    fetchReportedPairKeys([userAId, userBId]),
  ]);

  if (!ctxA.profile || !ctxB.profile) {
    throw new Error('Both users need profiles before comparing scores.');
  }

  const appearanceScoresByViewer = new Map<string, Map<string, number>>([
    [userAId, await fetchAppearanceFitScores(userAId, [userBId])],
    [userBId, await fetchAppearanceFitScores(userBId, [userAId])],
  ]);

  const context: MatchingContext = {
    recentPairKeys,
    reportedPairKeys,
    appearanceScoresByViewer,
  };

  const aToB = scoreDirectionalFit({
    viewer: ctxA.profile,
    viewerPrefs: ctxA.preferences,
    partner: ctxB.profile,
    context,
  });
  const bToA = scoreDirectionalFit({
    viewer: ctxB.profile,
    viewerPrefs: ctxB.preferences,
    partner: ctxA.profile,
    context,
  });
  const mutual = evaluateCompatibility({
    userA: { profile: ctxA.profile, preferences: ctxA.preferences },
    userB: { profile: ctxB.profile, preferences: ctxB.preferences },
    blockedA,
    blockedB,
    context,
  });

  const report = {
    userAId,
    userBId,
    priorityOrderA: ctxA.preferences.matchingPriorityOrder,
    priorityOrderB: ctxB.preferences.matchingPriorityOrder,
    scoreAtoB: aToB.score,
    scoreBtoA: bToA.score,
    mutualScore: mutual.score,
    compatible: mutual.compatible,
    blockers: mutual.blockers,
  };

  console.log('[SpeedSpark Dev] compareDevMatchScores', report);
  return report;
}

if (__DEV__) {
  (globalThis as Record<string, unknown>).SpeedSparkMatchingDev = {
    seedDevLiveWindow,
    simulateQueuePopulation,
    runDevPairing,
    printDevQueueReport,
    compareDevMatchScores,
  };
}
