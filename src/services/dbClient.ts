import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './supabaseEnv';

let clientOverride: SupabaseClient | null = null;
let defaultClientFactory: (() => SupabaseClient) | null = null;

/** Registers the app singleton client (called from supabase.ts on startup). */
export function registerDefaultDbClientFactory(factory: () => SupabaseClient): void {
  defaultClientFactory = factory;
}

/** Overrides the active client for pairing workers / Edge Functions (service role). */
export function setDbClientOverride(client: SupabaseClient | null): void {
  clientOverride = client;
}

export function resolveDbClient(): SupabaseClient {
  if (clientOverride) {
    return clientOverride;
  }
  if (defaultClientFactory) {
    return defaultClientFactory();
  }
  throw new Error(
    'Database client is not configured. Set Supabase env vars or provide a client override.',
  );
}

export function isDbAvailable(): boolean {
  return Boolean(clientOverride) || isSupabaseConfigured;
}

export async function runWithDbClient<T>(
  client: SupabaseClient,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = clientOverride;
  clientOverride = client;
  try {
    return await fn();
  } finally {
    clientOverride = previous;
  }
}
