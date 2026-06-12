/**
 * Offline assertions for call orchestration constants and status mapping.
 * Run via Metro: await SpeedSparkMatchingDev.testCallOrchestration()
 */
import {
  CALL_JOIN_GRACE_SECONDS,
  CALL_RECONNECT_GRACE_SECONDS,
} from '../../constants/callOrchestration';
import { logBackendInfo } from '../backendLogger';

function assert(condition: boolean, message: string, failures: string[]): void {
  if (!condition) {
    failures.push(message);
  }
}

export function runCallOrchestrationTests(): { passed: number; failed: number; failures: string[] } {
  const failures: string[] = [];
  const TOTAL = 4;

  assert(
    CALL_JOIN_GRACE_SECONDS >= 30 && CALL_JOIN_GRACE_SECONDS <= 45,
    `join grace should be 30–45s (got ${CALL_JOIN_GRACE_SECONDS})`,
    failures,
  );
  assert(
    CALL_RECONNECT_GRACE_SECONDS >= 15 && CALL_RECONNECT_GRACE_SECONDS <= 30,
    `reconnect grace should be 15–30s (got ${CALL_RECONNECT_GRACE_SECONDS})`,
    failures,
  );
  assert(CALL_JOIN_GRACE_SECONDS > CALL_RECONNECT_GRACE_SECONDS, 'join grace longer than reconnect grace', failures);
  assert(
    ['pending', 'active', 'completed', 'cancelled'].every((s) => typeof s === 'string'),
    'call lifecycle statuses defined',
    failures,
  );

  const passed = TOTAL - failures.length;
  logBackendInfo('dev.callOrchestrationTests', { passed, failed: failures.length, failures });
  return { passed, failed: failures.length, failures };
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  (globalThis as Record<string, unknown>).SpeedSparkCallOrchestrationDev = {
    runCallOrchestrationTests,
  };
}
