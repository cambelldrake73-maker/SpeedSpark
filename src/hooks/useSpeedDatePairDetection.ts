import { useCallback, useEffect, useRef } from 'react';
import {
  fetchActiveSpeedDateForUser,
  fetchProfile,
  subscribeToSpeedDatesForUser,
} from '../services';
import { isSupabaseConfigured } from '../services/supabaseEnv';
import type { SpeedDateRecord } from '../types/matchingBackend';
import type { UserProfile } from '../types';

const LOG_PREFIX = '[SpeedSpark Pair]';

export interface SpeedDatePairNavParams {
  partner: UserProfile;
  speedDateId: string;
}

function partnerIdForUser(speedDate: SpeedDateRecord, userId: string): string | null {
  if (speedDate.userAId === userId) {
    return speedDate.userBId;
  }
  if (speedDate.userBId === userId) {
    return speedDate.userAId;
  }
  return null;
}

/**
 * Subscribes to speed_dates for the current user and invokes onPaired when an
 * active date is detected. Used by lobby / queue screens without UI changes.
 */
export function useSpeedDatePairDetection(options: {
  userId: string | undefined;
  enabled: boolean;
  onPaired: (params: SpeedDatePairNavParams) => void;
}) {
  const { userId, enabled, onPaired } = options;
  const onPairedRef = useRef(onPaired);
  const handledSpeedDateIdsRef = useRef<Set<string>>(new Set());
  const resolvingRef = useRef(false);

  useEffect(() => {
    onPairedRef.current = onPaired;
  }, [onPaired]);

  const resolveActivePair = useCallback(
    async (trigger: string, hint?: SpeedDateRecord) => {
      if (!userId || !isSupabaseConfigured || resolvingRef.current) {
        return;
      }

      if (hint && hint.status !== 'active') {
        return;
      }

      resolvingRef.current = true;
      try {
        console.log(`${LOG_PREFIX} speed date event received`, { trigger, userId });

        const active = hint?.status === 'active' ? hint : await fetchActiveSpeedDateForUser(userId);
        if (!active || active.status !== 'active') {
          return;
        }

        if (handledSpeedDateIdsRef.current.has(active.id)) {
          return;
        }

        console.log(`${LOG_PREFIX} active speed date fetched`, {
          speedDateId: active.id,
          windowId: active.windowId,
        });

        const partnerId = partnerIdForUser(active, userId);
        if (!partnerId) {
          console.log(`${LOG_PREFIX} could not resolve partner id`, { speedDateId: active.id });
          return;
        }

        const partner = await fetchProfile(partnerId);
        if (!partner) {
          console.log(`${LOG_PREFIX} partner profile missing`, { partnerId });
          return;
        }

        console.log(`${LOG_PREFIX} partner profile fetched`, {
          partnerId: partner.id,
          partnerName: partner.name,
        });

        handledSpeedDateIdsRef.current.add(active.id);
        console.log(`${LOG_PREFIX} navigation triggered`, { speedDateId: active.id });
        onPairedRef.current({ partner, speedDateId: active.id });
      } catch (error) {
        console.log(`${LOG_PREFIX} pair detection failed`, error);
      } finally {
        resolvingRef.current = false;
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!enabled || !userId || !isSupabaseConfigured) {
      return;
    }

    console.log(`${LOG_PREFIX} subscription started`, { userId });

    const unsubscribe = subscribeToSpeedDatesForUser(userId, ({ speedDate, eventType }) => {
      if (eventType !== 'INSERT' && eventType !== 'UPDATE') {
        return;
      }
      if (speedDate.status !== 'active') {
        return;
      }
      void resolveActivePair(`realtime:${eventType}`, speedDate);
    });

    void resolveActivePair('initial-check');

    return () => {
      unsubscribe?.();
    };
  }, [enabled, userId, resolveActivePair]);
}
