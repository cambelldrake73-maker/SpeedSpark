import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ConnectionState, Room, RoomEvent, type RemoteParticipant } from 'livekit-client';
import type { CallConnectionState, CallLeaveReason } from '../types/call';
import { logCallError, logCallEvent } from '../services/callLogger';
import {
  cancelSpeedDateCall,
  completeSpeedDateCall,
  createCallRoom,
  fetchCallToken,
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

export interface UseSpeedDateCallOptions {
  speedDateId?: string;
  userId?: string;
  enabled: boolean;
}

export interface UseSpeedDateCallResult {
  connectionState: CallConnectionState;
  partnerConnected: boolean;
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  statusLabel: string;
  error: string | null;
  leave: (reason?: CallLeaveReason) => Promise<void>;
}

export function useSpeedDateCall(options: UseSpeedDateCallOptions): UseSpeedDateCallResult {
  const { speedDateId, userId, enabled } = options;
  const roomRef = useRef<Room | null>(null);
  const leavingRef = useRef(false);
  const connectAttemptRef = useRef(0);
  const [connectionState, setConnectionState] = useState<CallConnectionState>('idle');
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPartnerState = useCallback((room: Room | null) => {
    setPartnerConnected(hasRemoteParticipant(room));
  }, []);

  const leave = useCallback(
    async (reason: CallLeaveReason = 'complete') => {
      if (leavingRef.current) {
        return;
      }
      leavingRef.current = true;

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

        if (speedDateId && reason === 'cancel') {
          await cancelSpeedDateCall(speedDateId);
        } else if (speedDateId && reason !== 'unmount') {
          await completeSpeedDateCall(speedDateId);
        }
      } catch (leaveError) {
        logCallError('room.failed', leaveError, { speedDateId, stage: 'leave', reason });
      } finally {
        leavingRef.current = false;
        setConnectionState('disconnected');
        setPartnerConnected(false);
      }
    },
    [speedDateId],
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
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        logCallEvent('room.participant.joined', {
          speedDateId,
          participantId: participant.identity,
        });
        refreshPartnerState(room);
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        logCallEvent('room.participant.left', {
          speedDateId,
          participantId: participant.identity,
        });
        refreshPartnerState(room);
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
      refreshPartnerState(room);
      logCallEvent('room.joined', { speedDateId, roomName: tokenPayload.roomName });
    } catch (connectError) {
      const message =
        connectError instanceof Error ? connectError.message : 'Could not join voice call';
      setError(message);
      setConnectionState('failed');
      logCallError('room.failed', connectError, { speedDateId, attempt });
    }
  }, [refreshPartnerState, speedDateId, userId]);

  useEffect(() => {
    if (!enabled || !speedDateId || !userId) {
      setConnectionState('idle');
      setPartnerConnected(false);
      setError(null);
      return;
    }

    void connectWithFreshToken();

    return () => {
      connectAttemptRef.current += 1;
      void leave('unmount');
    };
  }, [connectWithFreshToken, enabled, leave, speedDateId, userId]);

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
        return partnerConnected ? 'Voice connected' : 'Waiting for date…';
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
    partnerConnected,
    isMuted,
    setMuted,
    statusLabel,
    error,
    leave,
  };
}
