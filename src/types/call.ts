export type SpeedDateCallStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export type CallCancelReason = 'no_show' | 'user_cancel' | 'block' | 'partner_abandoned';

export type CallConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export type PartnerConnectionStatus =
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting';

export type CallLeaveReason = 'complete' | 'cancel' | 'unmount' | 'no_show';

export interface CallTokenResponse {
  token: string;
  roomName: string;
  url: string;
  expiresAt: string;
}

export interface CallOrchestrationState {
  ok: boolean;
  callStatus?: SpeedDateCallStatus;
  cancelReason?: CallCancelReason | null;
  bothJoined?: boolean;
  shouldStartTimer?: boolean;
  bothJoinedAt?: string | null;
  userAJoinedAt?: string | null;
  userBJoinedAt?: string | null;
  userALeftAt?: string | null;
  userBLeftAt?: string | null;
  noShowUserId?: string | null;
  error?: string;
}

export interface CallParticipantJoinedResult extends CallOrchestrationState {
  userAJoinedAt?: string | null;
  userBJoinedAt?: string | null;
}

export interface CallNoShowResult {
  ok: boolean;
  callStatus?: SpeedDateCallStatus;
  cancelReason?: CallCancelReason;
  noShowUserId?: string;
  returnedToQueueUserId?: string;
  alreadyEnded?: boolean;
  error?: string;
}

export interface CallCompleteResult {
  ok: boolean;
  callStatus?: SpeedDateCallStatus;
  bothJoinedAt?: string | null;
  alreadyCompleted?: boolean;
  error?: string;
}
