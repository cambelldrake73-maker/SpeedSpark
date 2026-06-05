/**
 * Development-only helpers for queue / matching / pairing.
 * Call from Metro console or temporary __DEV__ buttons — not for production UI.
 */
import { logBackendInfo } from '../backendLogger';
import { runPairingForWindow } from '../pairingEngine';
import { joinQueue, getQueueCounts, getWaitingQueueEntries } from '../queueService';
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
  const outcome = await runPairingForWindow(windowId);
  logBackendInfo('dev.pairing.done', { ...outcome });
  return outcome;
}

export async function printDevQueueReport(windowId: string) {
  const counts = await getQueueCounts(windowId);
  const waiting = await getWaitingQueueEntries(windowId);
  const windows = await fetchSpeedDateWindows();
  console.log('[SpeedSpark Dev] windows', windows);
  console.log('[SpeedSpark Dev] queue counts', counts);
  console.log('[SpeedSpark Dev] waiting entries', waiting);
}

if (__DEV__) {
  (globalThis as Record<string, unknown>).SpeedSparkMatchingDev = {
    seedDevLiveWindow,
    simulateQueuePopulation,
    runDevPairing,
    printDevQueueReport,
  };
}
