const PREFIX = '[SpeedSpark Backend]';

export function logBackendInfo(event: string, detail?: Record<string, unknown>): void {
  console.log(`${PREFIX} ${event}`, detail ?? '');
}

export function logBackendError(event: string, error: unknown, detail?: Record<string, unknown>): void {
  console.error(`${PREFIX} ✗ ${event}`, error, detail ?? '');
}

export function logQueueEvent(
  action: 'join' | 'leave' | 'status' | 'counts',
  detail: Record<string, unknown>,
): void {
  logBackendInfo(`queue.${action}`, detail);
}

export function logMatchDecision(detail: {
  viewerId: string;
  partnerId: string;
  compatible: boolean;
  score: number;
  blockers?: string[];
  reasons?: string[];
}): void {
  logBackendInfo('matching.decision', detail);
}

export function logPairingOutcome(outcome: {
  windowId: string;
  pairsCreated: number;
  unmatched: number;
  skipped: number;
}): void {
  logBackendInfo('pairing.outcome', outcome);
}
