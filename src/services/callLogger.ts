import { logBackendInfo, logBackendError } from './backendLogger';

const EVENT_PREFIX = 'call';

export type CallLogEvent =
  | 'room.create.requested'
  | 'room.created'
  | 'room.token.requested'
  | 'room.token.issued'
  | 'room.token.failed'
  | 'room.joining'
  | 'room.joined'
  | 'room.left'
  | 'room.failed'
  | 'room.reconnecting'
  | 'room.reconnected'
  | 'room.participant.joined'
  | 'room.participant.left';

export function logCallEvent(event: CallLogEvent, detail?: Record<string, unknown>): void {
  logBackendInfo(`${EVENT_PREFIX}.${event}`, detail);
}

export function logCallError(
  event: CallLogEvent,
  error: unknown,
  detail?: Record<string, unknown>,
): void {
  logBackendError(`${EVENT_PREFIX}.${event}`, error, detail);
}
