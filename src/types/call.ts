export type SpeedDateCallStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export type CallConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export type CallLeaveReason = 'complete' | 'cancel' | 'unmount';

export interface CallTokenResponse {
  token: string;
  roomName: string;
  url: string;
  expiresAt: string;
}
