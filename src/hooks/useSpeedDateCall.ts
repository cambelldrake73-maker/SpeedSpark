import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ConnectionState, Room, RoomEvent, type RemoteParticipant } from 'livekit-client';
import {
  CALL_JOIN_GRACE_SECONDS,
  CALL_RECONNECT_GRACE_SECONDS,
} from '../constants/callOrchestration';
import type {
  CallConnectionState,
  CallLeaveReason,
  PartnerConnectionStatus,
  SpeedDateCallStatus,
} from '../types/call';
import { logCallError, logCallEvent } from '../services/callLogger';
import {
  cancelCallNoShow,
  completeCallIfValid,
  createCallRoom,
  fetchCallOrchestrationState,
  fetchCallToken,
  markCallParticipantJoined,
  markCallParticipantLeft,
  cancelSpeedDateCall,
} from '../services/callTokens';

function mapConnectionState(state: ConnectionState): CallConnectionState {
  switch (state) {
    case ConnectionState.Connected:
      return 'connected';
    case ConnectionState.Connecting:
      return 'connecting';
    case ConnectionState.Reconnecting:
      return 'reconnecting';
    case ConnectionState.Disconnected:
      return 'disconnected';
    default:
      return 'idle';
  }
}

function hasRemoteParticipant(room: Room | null): boolean {
  if (!room) {
    return false;
  }
  return room.remoteParticipants.size > 0;
}

function derivePartnerConnectionStatus(
  connectionState: CallConnectionState,
  localJoined: boolean,
  partnerJoined: boolean,
): PartnerConnectionStatus {
  if (connectionState === 'reconnecting') {
    return 'reconnecting';
  }
  if (connectionState === 'connecting' || connectionState === 'idle') {
    return 'connecting';
  }
  if (!localJoined) {
    return 'connecting';
  }
  if (partnerJoined) {
    return 'connected';
  }
  if (connectionState === 'disconnected' || connectionState === 'failed') {
    return 'disconnected';
  }
  return 'waiting';
}

export interface UseSpeedDateCallOptions {
  speedDateId?: string;
  userId?: string;
  enabled: boolean;
  onNoShow?: () => void;
  onPartnerAbandoned?: () => void;
}

export interface UseSpeedDateCallResult {
  connectionState: CallConnectionState;
  partnerConnectionStatus: PartnerConnectionStatus;
  localJoined: boolean;
  partnerJoined: boolean;
  bothJoined: boolean;
  shouldStartTimer: boolean;
  callStatus: SpeedDateCallStatus;
  partnerConnected: boolean;
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  statusLabel: string;
  error: string | null;
  leave: (reason?: CallLeaveReason) => Promise<void>;
}

export function useSpeedDateCall(options: UseSpeedDateCallOptions): UseSpeedDateCallResult {
  const { speedDateId, userId, enabled, onNoShow, onPartnerAbandoned } = options;
  const roomRef = useRef<Room | null>(null);
  const leavingRef = useRef(false);
  const connectAttemptRef = useRef(0);
  const joinGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bothJoinedRef = useRef(false);
  const timerStartedLoggedRef = useRef(false);
  const noShowHandledRef = useRef(false);
  const partnerAbandonedHandledRef = useRef(false);
  const onNoShowRef = useRef(onNoShow);
  const onPartnerAbandonedRef = useRef(onPartnerAbandoned);

  const [connectionState, setConnectionState] = useState<CallConnectionState>('idle');
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [bothJoined, setBothJoined] = useState(false);
  const [callStatus, setCallStatus] = useState<SpeedDateCallStatus>('pending');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  onNoShowRef.current = onNoShow;
  onPartnerAbandonedRef.current = onPartnerAbandoned;

  const localJoined = connectionState === 'connected' || connectionState === 'reconnecting';
  const shouldStartTimer = bothJoined;
  const partnerConnectionStatus = derivePartnerConnectionStatus(
    connectionState,
    localJoined,
    partnerJoined,
  );

  const clearJoinGraceTimer = useCallback(() => {
    if (joinGraceTimerRef.current) {
      clearTimeout(joinGraceTimerRef.current);
      joinGraceTimerRef.current = null;
    }
  }, []);

  const clearReconnectGraceTimer = useCallback(() => {
    if (reconnectGraceTimerRef.current) {
      clearTimeout(reconnectGraceTimerRef.current);
      reconnectGraceTimerRef.current = null;
    }
  }, []);

  const syncBothJoined = useCallback(
    async (remotePresent: boolean) => {
      if (!speedDateId) {
        return;
      }

      setPartnerJoined(remotePresent);

      try {
        const state = await fetchCallOrchestrationState(speedDateId);
        if (state.callStatus) {
          setCallStatus(state.callStatus);
        }

        const serverBothJoined = Boolean(state.shouldStartTimer ?? state.bothJoined);
        const liveBothJoined = localJoined && remotePresent;

        if (serverBothJoined || liveBothJoined) {
          if (!bothJoinedRef.current) {
            bothJoinedRef.current = true;
            setBothJoined(true);
            clearJoinGraceTimer();
            clearReconnectGraceTimer();
            if (!timerStartedLoggedRef.current) {
              timerStartedLoggedRef.current = true;
              logCallEvent('timer.started', { speedDateId });
            }
          }
        }
      } catch (syncError) {
        logCallError('room.failed', syncError, { speedDateId, stage: 'sync-both-joined' });
        if (localJoined && remotePresent && !bothJoinedRef.current) {
          bothJoinedRef.current = true;
          setBothJoined(true);
          clearJoinGraceTimer();
          clearReconnectGraceTimer();
        }
      }
    },
    [clearJoinGraceTimer, clearReconnectGraceTimer, localJoined, speedDateId],
  );

  const refreshPartnerState = useCallback(
    (room: Room | null) => {
      const remotePresent = hasRemoteParticipant(room);
      void syncBothJoined(remotePresent);
    },
    [syncBothJoined],
  );

  const handleNoShow = useCallback(async () => {
    if (!speedDateId || noShowHandledRef.current || bothJoinedRef.current) {
      return;
    }
    noShowHandledRef.current = true;
    clearJoinGraceTimer();

    try {
      await cancelCallNoShow(speedDateId);
      setCallStatus('cancelled');
      await roomRef.current?.disconnect(true);
      roomRef.current = null;
      onNoShowRef.current?.();
    } catch (noShowError) {
      noShowHandledRef.current = false;
      logCallError('no_show.cancel.failed', noShowError, { speedDateId });
    }
  }, [clearJoinGraceTimer, speedDateId]);

  const startJoinGraceTimer = useCallback(() => {
    if (!speedDateId || bothJoinedRef.current || joinGraceTimerRef.current) {
      return;
    }

    joinGraceTimerRef.current = setTimeout(() => {
      joinGraceTimerRef.current = null;
      if (!bothJoinedRef.current) {
        void handleNoShow();
      }
    }, CALL_JOIN_GRACE_SECONDS * 1000);
  }, [handleNoShow, speedDateId]);

  const startReconnectGraceTimer = useCallback(() => {
    if (!speedDateId || !bothJoinedRef.current || reconnectGraceTimerRef.current) {
      return;
    }

    reconnectGraceTimerRef.current = setTimeout(() => {
      reconnectGraceTimerRef.current = null;
      if (!hasRemoteParticipant(roomRef.current) && !partnerAbandonedHandledRef.current) {
        partnerAbandonedHandledRef.current = true;
        logCallEvent('partner.abandoned', { speedDateId });
        onPartnerAbandonedRef.current?.();
      }
    }, CALL_RECONNECT_GRACE_SECONDS * 1000);
  }, [speedDateId]);

  const leave = useCallback(
    async (reason: CallLeaveReason = 'complete') => {
      if (leavingRef.current) {
        return;
      }
      leavingRef.current = true;

      clearJoinGraceTimer();
      clearReconnectGraceTimer();

      const room = roomRef.current;
      roomRef.current = null;

      try {
        if (room) {
          await room.disconnect(true);
          logCallEvent('room.left', { speedDateId, reason });
        }

        if (Platform.OS !== 'web') {
          try {
            const { AudioSession } = await import('@livekit/react-native');
            await AudioSession.stopAudioSession();
          } catch (audioError) {
            logCallError('room.failed', audioError, { speedDateId, stage: 'stop-audio-session' });
          }
        }

        if (speedDateId && reason !== 'unmount' && reason !== 'no_show') {
          try {
            await markCallParticipantLeft(speedDateId);
          } catch (leftError) {
            logCallError('participant.left.failed', leftError, { speedDateId, reason });
          }
        }

        if (speedDateId && reason === 'cancel') {
          await cancelSpeedDateCall(speedDateId);
        } else if (speedDateId && reason === 'complete' && bothJoinedRef.current) {
          await completeCallIfValid(speedDateId);
        }
      } catch (leaveError) {
        logCallError('room.failed', leaveError, { speedDateId, stage: 'leave', reason });
      } finally {
        leavingRef.current = false;
        setConnectionState('disconnected');
        setPartnerJoined(false);
        setBothJoined(false);
        bothJoinedRef.current = false;
      }
    },
    [clearJoinGraceTimer, clearReconnectGraceTimer, speedDateId],
  );

  const setMuted = useCallback((muted: boolean) => {
    setIsMuted(muted);
    const room = roomRef.current;
    if (room) {
      void room.localParticipant.setMicrophoneEnabled(!muted);
    }
  }, []);

  const connectWithFreshToken = useCallback(async () => {
    if (!speedDateId || !userId || leavingRef.current) {
      return;
    }

    const attempt = ++connectAttemptRef.current;
    setConnectionState('connecting');
    setError(null);

    try {
      logCallEvent('room.joining', { speedDateId, userId, attempt });

      await createCallRoom(speedDateId);
      const tokenPayload = await fetchCallToken(speedDateId);

      if (leavingRef.current || attempt !== connectAttemptRef.current) {
        return;
      }

      if (Platform.OS !== 'web') {
        const { AudioSession } = await import('@livekit/react-native');
        await AudioSession.startAudioSession();
      }

      const room = new Room({
        adaptiveStream: false,
        dynacast: false,
      });
      roomRef.current = room;

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        setConnectionState(mapConnectionState(state));
      });

      room.on(RoomEvent.Reconnecting, () => {
        logCallEvent('room.reconnecting', { speedDateId });
        setConnectionState('reconnecting');
      });

      room.on(RoomEvent.Reconnected, () => {
        logCallEvent('room.reconnected', { speedDateId });
        setConnectionState('connected');
        refreshPartnerState(room);
        void markCallParticipantJoined(speedDateId).catch((joinError) => {
          logCallError('participant.joined.failed', joinError, { speedDateId, stage: 'reconnect' });
        });
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        logCallEvent('room.participant.joined', {
          speedDateId,
          participantId: participant.identity,
        });
        clearReconnectGraceTimer();
        refreshPartnerState(room);
        void markCallParticipantJoined(speedDateId).then(() => {
          refreshPartnerState(room);
        });
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        logCallEvent('room.participant.left', {
          speedDateId,
          participantId: participant.identity,
        });
        setPartnerJoined(false);
        if (bothJoinedRef.current) {
          startReconnectGraceTimer();
        } else {
          refreshPartnerState(room);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        refreshPartnerState(room);
      });

      await room.connect(tokenPayload.url, tokenPayload.token);
      await room.localParticipant.setMicrophoneEnabled(true);

      if (leavingRef.current || attempt !== connectAttemptRef.current) {
        await room.disconnect(true);
        return;
      }

      setConnectionState('connected');
      logCallEvent('room.joined', { speedDateId, roomName: tokenPayload.roomName });

      const joinResult = await markCallParticipantJoined(speedDateId);
      if (joinResult.callStatus) {
        setCallStatus(joinResult.callStatus);
      }

      refreshPartnerState(room);

      if (joinResult.bothJoined || joinResult.shouldStartTimer) {
        bothJoinedRef.current = true;
        setBothJoined(true);
        clearJoinGraceTimer();
        if (!timerStartedLoggedRef.current) {
          timerStartedLoggedRef.current = true;
          logCallEvent('timer.started', { speedDateId });
        }
      } else {
        startJoinGraceTimer();
      }
    } catch (connectError) {
      const message =
        connectError instanceof Error ? connectError.message : 'Could not join voice call';
      setError(message);
      setConnectionState('failed');
      logCallError('room.failed', connectError, { speedDateId, attempt });
    }
  }, [
    clearJoinGraceTimer,
    clearReconnectGraceTimer,
    refreshPartnerState,
    speedDateId,
    startJoinGraceTimer,
    startReconnectGraceTimer,
    userId,
  ]);

  useEffect(() => {
    if (!enabled || !speedDateId || !userId) {
      setConnectionState('idle');
      setPartnerJoined(false);
      setBothJoined(false);
      bothJoinedRef.current = false;
      setError(null);
      return;
    }

    void connectWithFreshToken();

    return () => {
      connectAttemptRef.current += 1;
      clearJoinGraceTimer();
      clearReconnectGraceTimer();
      void leave('unmount');
    };
  }, [
    clearJoinGraceTimer,
    clearReconnectGraceTimer,
    connectWithFreshToken,
    enabled,
    leave,
    speedDateId,
    userId,
  ]);

  const statusLabel = (() => {
    if (!speedDateId) {
      return 'Demo mode';
    }
    switch (connectionState) {
      case 'connecting':
        return 'Connecting…';
      case 'reconnecting':
        return 'Reconnecting…';
      case 'connected':
        if (bothJoined) {
          return 'Voice connected';
        }
        return partnerJoined ? 'Partner joining…' : 'Waiting for date…';
      case 'failed':
        return 'Connection failed';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Starting…';
    }
  })();

  return {
    connectionState,
    partnerConnectionStatus,
    localJoined,
    partnerJoined,
    bothJoined,
    shouldStartTimer,
    callStatus,
    partnerConnected: partnerJoined,
    isMuted,
    setMuted,
    statusLabel,
    error,
    leave,
  };
}
