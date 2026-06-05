/**
 * Marks execution inside a trusted server pairing context (Edge Function / service role).
 * When true, matching data is loaded via SECURITY DEFINER RPC — not client RLS.
 */
let serverPairingExecution = false;

export function isServerPairingExecution(): boolean {
  return serverPairingExecution;
}

export async function runInServerPairingContext<T>(fn: () => Promise<T>): Promise<T> {
  const previous = serverPairingExecution;
  serverPairingExecution = true;
  try {
    return await fn();
  } finally {
    serverPairingExecution = previous;
  }
}
