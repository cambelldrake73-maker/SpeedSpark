import { createClient } from 'npm:@supabase/supabase-js@2';
import { runWithDbClient } from '../../../src/services/dbClient.ts';
import { runInServerPairingContext } from '../../../src/services/pairingExecutionContext.ts';
import { runPairingForAllLiveWindows } from '../../../src/services/pairingCoordinator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-pairing-secret',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pairingSecret = Deno.env.get('PAIRING_CRON_SECRET');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  if (pairingSecret) {
    const provided = req.headers.get('x-pairing-secret');
    if (provided !== pairingSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  let windowId: string | undefined;
  try {
    const body = req.method === 'POST' ? await req.json() : {};
    windowId = typeof body?.windowId === 'string' ? body.windowId : undefined;
  } catch {
    windowId = undefined;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await runWithDbClient(admin, () =>
      runInServerPairingContext(() =>
        runPairingForAllLiveWindows('edge_function', { windowId }),
      ),
    );

    return jsonResponse({
      ok: true,
      windowsScanned: result.windowsScanned,
      totalPairsCreated: result.runs.reduce((sum, run) => sum + run.outcome.pairsCreated, 0),
      runs: result.runs.map((run) => ({
        windowId: run.windowId,
        candidatesConsidered: run.candidatesConsidered,
        pairsCreated: run.outcome.pairsCreated,
        unmatched: run.outcome.unmatchedUserIds.length,
        skipped: run.outcome.skippedPairs.length,
        skippedLock: run.skippedLock ?? false,
        topScores: run.outcome.evaluatedPairs?.slice(0, 5) ?? [],
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[pair-live-windows] failed', message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
