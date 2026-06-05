import { useCallback, useEffect, useState } from 'react';
import {
  fetchSpeedDateMatchResult,
  subscribeToFeedbackForSpeedDate,
  subscribeToMatchesForUser,
  type SpeedDateMatchResult,
} from '../services';
import { isSupabaseConfigured } from '../services/supabaseEnv';
import { formatAuthErrorForUser } from '../utils/authErrors';
import { isBackendSpeedDateId } from '../utils/speedDateIds';

const POLL_MS = 3000;

/**
 * Loads mutual-match resolution for a completed speed date (backend UUID only).
 */
export function useSpeedDateMatchResult(speedDateId: string | undefined, userId: string | undefined) {
  const useBackend =
    isSupabaseConfigured && Boolean(userId) && Boolean(speedDateId && isBackendSpeedDateId(speedDateId));

  const [result, setResult] = useState<SpeedDateMatchResult | null>(null);
  const [isLoading, setIsLoading] = useState(useBackend);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!useBackend || !speedDateId) {
      return;
    }

    try {
      const next = await fetchSpeedDateMatchResult(speedDateId);
      setResult(next);
      setError(null);
    } catch (err) {
      setError(formatAuthErrorForUser(err));
    } finally {
      setIsLoading(false);
    }
  }, [useBackend, speedDateId]);

  useEffect(() => {
    if (!useBackend || !speedDateId || !userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    void refresh();
  }, [useBackend, speedDateId, userId, refresh]);

  useEffect(() => {
    if (!useBackend || !speedDateId || !userId) {
      return;
    }

    const unsubscribeFeedback = subscribeToFeedbackForSpeedDate(speedDateId, () => {
      void refresh();
    });

    const unsubscribeMatches = subscribeToMatchesForUser(userId, () => {
      void refresh();
    });

    return () => {
      unsubscribeFeedback?.();
      unsubscribeMatches?.();
    };
  }, [useBackend, speedDateId, userId, refresh]);

  useEffect(() => {
    if (!useBackend || !speedDateId || result?.status !== 'waiting') {
      return;
    }

    const interval = setInterval(() => {
      void refresh();
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [useBackend, speedDateId, result?.status, refresh]);

  return {
    useBackend,
    result,
    isLoading,
    error,
    refresh,
  };
}
