import { AUTO_PAIRING_INTERVAL_MS } from '../constants/autoPairing';
import { logBackendInfo } from './backendLogger';
import { isDbAvailable } from './dbClient';
import { invokeServerPairing } from './pairingRemote';

let intervalId: ReturnType<typeof setInterval> | null = null;
let runInFlight = false;

async function tick(): Promise<void> {
  if (runInFlight || !isDbAvailable()) {
    return;
  }

  runInFlight = true;
  try {
    await invokeServerPairing();
  } catch (error) {
    logBackendInfo('pairing.worker.error', {
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    runInFlight = false;
  }
}

/**
 * Starts the in-app pairing trigger (no UI). Invokes the server Edge Function on
 * an interval — matching never runs with client RLS credentials.
 */
export function startAutoPairingWorker(): void {
  if (intervalId || !isDbAvailable()) {
    return;
  }

  logBackendInfo('pairing.worker.start', {
    intervalMs: AUTO_PAIRING_INTERVAL_MS,
    mode: 'edge_function_invoke',
  });
  void tick();
  intervalId = setInterval(() => {
    void tick();
  }, AUTO_PAIRING_INTERVAL_MS);
}

/** Stops the in-app pairing trigger. */
export function stopAutoPairingWorker(): void {
  if (!intervalId) {
    return;
  }

  clearInterval(intervalId);
  intervalId = null;
  logBackendInfo('pairing.worker.stop', {});
}

export function isAutoPairingWorkerRunning(): boolean {
  return intervalId !== null;
}
