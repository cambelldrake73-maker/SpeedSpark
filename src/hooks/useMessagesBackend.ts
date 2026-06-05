import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchMatchById,
  fetchMatchThread,
  fetchUserMatches,
  mergeMessages,
  sendMessage as sendMessageService,
  subscribeToMatchMessages,
  subscribeToMatchesForUser,
} from '../services';
import { isSupabaseConfigured } from '../services/supabaseEnv';
import { formatAuthErrorForUser } from '../utils/authErrors';
import type { Match, Message } from '../types';

export function useMessagesBackend(
  userId: string | undefined,
  activeMatchId: string | null,
  initialMatchId?: string,
) {
  const useBackend = isSupabaseConfigured && Boolean(userId);

  const [matches, setMatches] = useState<Match[]>([]);
  const [messagesByMatch, setMessagesByMatch] = useState<Record<string, Message[]>>({});
  const [isLoadingList, setIsLoadingList] = useState(useBackend);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentMessageIdsRef = useRef<Set<string>>(new Set());

  const refreshMatches = useCallback(async () => {
    if (!useBackend || !userId) {
      return;
    }

    setIsLoadingList(true);
    setError(null);
    try {
      const next = await fetchUserMatches(userId);
      setMatches(next);
    } catch (err) {
      setError(formatAuthErrorForUser(err));
    } finally {
      setIsLoadingList(false);
    }
  }, [useBackend, userId]);

  const ensureMatchInList = useCallback(
    async (matchId: string) => {
      if (!useBackend || !userId) {
        return;
      }

      try {
        const match = await fetchMatchById(matchId, userId);
        if (match) {
          setMatches((prev) => {
            if (prev.some((item) => item.id === match.id)) {
              return prev;
            }
            return [match, ...prev];
          });
        }
      } catch (err) {
        setError(formatAuthErrorForUser(err));
      }
    },
    [useBackend, userId],
  );

  const loadThread = useCallback(
    async (matchId: string) => {
      if (!useBackend || !userId) {
        return;
      }

      setIsLoadingThread(true);
      setError(null);
      try {
        await ensureMatchInList(matchId);
        const thread = await fetchMatchThread(matchId, userId);
        setMessagesByMatch((prev) => ({ ...prev, [matchId]: thread }));
      } catch (err) {
        setError(formatAuthErrorForUser(err));
      } finally {
        setIsLoadingThread(false);
      }
    },
    [useBackend, userId, ensureMatchInList],
  );

  useEffect(() => {
    if (!useBackend || !userId) {
      return;
    }

    if (initialMatchId) {
      void ensureMatchInList(initialMatchId);
    }

    void refreshMatches();

    const unsubscribe = subscribeToMatchesForUser(userId, () => {
      void refreshMatches();
    });

    return () => {
      unsubscribe?.();
    };
  }, [useBackend, userId, initialMatchId, ensureMatchInList, refreshMatches]);

  useEffect(() => {
    if (!useBackend || !userId || !activeMatchId) {
      return;
    }

    void loadThread(activeMatchId);

    const unsubscribe = subscribeToMatchMessages(activeMatchId, (message) => {
      if (sentMessageIdsRef.current.has(message.id)) {
        return;
      }

      setMessagesByMatch((prev) => ({
        ...prev,
        [activeMatchId]: mergeMessages(prev[activeMatchId] ?? [], message),
      }));

      setMatches((prev) =>
        prev.map((match) =>
          match.id === activeMatchId
            ? {
                ...match,
                lastMessage: message.text,
                lastMessageAt: message.sentAt,
              }
            : match,
        ),
      );
    });

    return () => {
      unsubscribe?.();
    };
  }, [useBackend, userId, activeMatchId, loadThread]);

  const sendMessage = useCallback(
    async (matchId: string, text: string) => {
      if (!useBackend || !userId) {
        throw new Error('Messaging is not available right now.');
      }

      setError(null);
      const message = await sendMessageService(userId, matchId, text);
      sentMessageIdsRef.current.add(message.id);

      setMessagesByMatch((prev) => ({
        ...prev,
        [matchId]: mergeMessages(prev[matchId] ?? [], message),
      }));

      setMatches((prev) =>
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

      return message;
    },
    [useBackend, userId],
  );

  const removeMatchLocally = useCallback((matchId: string) => {
    setMatches((prev) => prev.filter((match) => match.id !== matchId));
    setMessagesByMatch((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  }, []);

  return {
    useBackend,
    matches,
    messagesByMatch,
    isLoadingList,
    isLoadingThread,
    error,
    sendMessage,
    refreshMatches,
    removeMatchLocally,
  };
}
