import { useCallback, useEffect, useState } from 'react';
import { MOCK_SPEED_DATE_WINDOWS } from '../data/mockSpeedDates';
import {
  fetchSpeedDateWindows,
  getQueueCounts,
  getQueueStatus,
  joinQueue as joinQueueService,
  leaveQueue as leaveQueueService,
  subscribeToQueueWindow,
} from '../services';
import { isSupabaseConfigured } from '../services/supabaseEnv';
import { formatAuthErrorForUser } from '../utils/authErrors';
import type { SpeedDateWindow } from '../types';

/**
 * Supplies lobby window + queue data from Supabase when configured.
 * Falls back to mock windows with no remote queue operations.
 */
export function useLobbyBackend(userId: string | undefined) {
  const useBackend = isSupabaseConfigured && Boolean(userId);

  const [liveWindow, setLiveWindow] = useState<SpeedDateWindow | undefined>(
    () => MOCK_SPEED_DATE_WINDOWS.find((w) => w.isLive),
  );
  const [upcomingWindows, setUpcomingWindows] = useState<SpeedDateWindow[]>(() =>
    MOCK_SPEED_DATE_WINDOWS.filter((w) => !w.isLive),
  );
  const [waitingCount, setWaitingCount] = useState(liveWindow?.queueCount ?? 0);
  const [inQueue, setInQueue] = useState(false);
  const [isLoading, setIsLoading] = useState(useBackend);
  const [error, setError] = useState<string | null>(null);

  const refreshWindows = useCallback(async () => {
    if (!useBackend) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const windows = await fetchSpeedDateWindows();
      setLiveWindow(windows.find((w) => w.isLive));
      setUpcomingWindows(windows.filter((w) => !w.isLive));
      const live = windows.find((w) => w.isLive);
      if (live && userId) {
        const status = await getQueueStatus(userId, live.id);
        setInQueue(status.inQueue);
        const counts = await getQueueCounts(live.id);
        setWaitingCount(counts.waiting);
      }
    } catch (err) {
      setError(formatAuthErrorForUser(err));
    } finally {
      setIsLoading(false);
    }
  }, [useBackend, userId]);

  useEffect(() => {
    void refreshWindows();
  }, [refreshWindows]);

  useEffect(() => {
    if (!useBackend || !liveWindow?.id) {
      return;
    }

    const unsubscribe = subscribeToQueueWindow(liveWindow.id, ({ counts }) => {
      setWaitingCount(counts.waiting);
    });

    return () => {
      unsubscribe?.();
    };
  }, [useBackend, liveWindow?.id]);

  const joinQueue = useCallback(async () => {
    if (!useBackend || !userId || !liveWindow?.id) {
      return false;
    }
    setError(null);
    try {
      await joinQueueService(userId, liveWindow.id);
      setInQueue(true);
      const counts = await getQueueCounts(liveWindow.id);
      setWaitingCount(counts.waiting);
      return true;
    } catch (err) {
      setError(formatAuthErrorForUser(err));
      return false;
    }
  }, [useBackend, userId, liveWindow?.id]);

  const leaveQueue = useCallback(async () => {
    if (!useBackend || !userId || !liveWindow?.id) {
      setInQueue(false);
      return;
    }
    setError(null);
    try {
      await leaveQueueService(userId, liveWindow.id);
      setInQueue(false);
      const counts = await getQueueCounts(liveWindow.id);
      setWaitingCount(counts.waiting);
    } catch (err) {
      setError(formatAuthErrorForUser(err));
    }
  }, [useBackend, userId, liveWindow?.id]);

  return {
    useBackend,
    liveWindow: useBackend ? liveWindow : MOCK_SPEED_DATE_WINDOWS.find((w) => w.isLive),
    upcomingWindows: useBackend
      ? upcomingWindows
      : MOCK_SPEED_DATE_WINDOWS.filter((w) => !w.isLive),
    waitingCount: useBackend ? waitingCount : liveWindow?.queueCount ?? 0,
    inQueue,
    isLoading,
    error,
    joinQueue,
    leaveQueue,
    refreshWindows,
  };
}
