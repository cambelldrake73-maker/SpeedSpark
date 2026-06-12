import { createClient } from 'npm:@supabase/supabase-js@2';
import { runWithDbClient } from '../../../src/services/dbClient.ts';
import { runInServerPairingContext } from '../../../src/services/pairingExecutionContext.ts';
import {
  runPairingForAllLiveWindows,
  runPlanPairsForWindowWithCoordinator,
} from '../../../src/services/pairingCoordinator.ts';
import {
  commitPairReservation,
  expirePairReservations,
  fetchReservationsForWindow,
} from '../../../src/services/reservationService.ts';
import {
  fetchReservationMetrics,
  printOrchestrationReport,
} from '../../../src/services/orchestrationMetrics.ts';
import {
  persistReservationCommitRun,
  persistReservationExpireRun,
} from '../../../src/services/pairingRunLog.ts';

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
  let mode: 'pair' | 'plan' = 'pair';
  let action:
    | 'commit'
    | 'expire'
    | 'report'
    | 'seedActiveDate'
    | 'endSpeedDate'
    | 'orchestrationReport'
    | 'reservationMetrics'
    | undefined;
  let reservationId: string | undefined;
  let speedDateId: string | undefined;
  let userAId: string | undefined;
  let userBId: string | undefined;
  let secondsRemaining: number | undefined;
  try {
    const body = req.method === 'POST' ? await req.json() : {};
    windowId = typeof body?.windowId === 'string' ? body.windowId : undefined;
    mode = body?.mode === 'plan' ? 'plan' : 'pair';
    action =
      body?.action === 'commit' ||
      body?.action === 'expire' ||
      body?.action === 'report' ||
      body?.action === 'seedActiveDate' ||
      body?.action === 'endSpeedDate' ||
      body?.action === 'orchestrationReport' ||
      body?.action === 'reservationMetrics'
        ? body.action
        : undefined;
    reservationId = typeof body?.reservationId === 'string' ? body.reservationId : undefined;
    speedDateId = typeof body?.speedDateId === 'string' ? body.speedDateId : undefined;
    userAId = typeof body?.userAId === 'string' ? body.userAId : undefined;
    userBId = typeof body?.userBId === 'string' ? body.userBId : undefined;
    secondsRemaining =
      typeof body?.secondsRemaining === 'number' ? body.secondsRemaining : undefined;
  } catch {
    windowId = undefined;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (action === 'expire') {
      const expiredCount = await runWithDbClient(admin, () =>
        runInServerPairingContext(async () => {
          const count = await expirePairReservations();
          await persistReservationExpireRun({
            windowId,
            triggerSource: 'edge_function',
            expiredCount: count,
          });
          return count;
        }),
      );
      return jsonResponse({ ok: true, expiredCount });
    }

    if (action === 'commit') {
      if (!reservationId) {
        return jsonResponse({ ok: false, error: 'reservationId required for commit action' }, 400);
      }
      const commitResult = await runWithDbClient(admin, () =>
        runInServerPairingContext(async () => {
          const result = await commitPairReservation(reservationId!);
          if (result.windowId) {
            await persistReservationCommitRun({
              windowId: result.windowId,
              triggerSource: 'edge_function',
              result,
            });
          }
          return result;
        }),
      );
      return jsonResponse({ ok: true, commitResult });
    }

    if (action === 'orchestrationReport') {
      if (!windowId) {
        return jsonResponse({ ok: false, error: 'windowId required for orchestrationReport' }, 400);
      }
      const report = await runWithDbClient(admin, () =>
        runInServerPairingContext(() => printOrchestrationReport(windowId!)),
      );
      return jsonResponse({ ok: true, orchestrationReport: report });
    }

    if (action === 'reservationMetrics') {
      if (!windowId) {
        return jsonResponse({ ok: false, error: 'windowId required for reservationMetrics' }, 400);
      }
      const metrics = await runWithDbClient(admin, () =>
        runInServerPairingContext(() => fetchReservationMetrics(windowId!)),
      );
      return jsonResponse({ ok: true, reservationMetrics: metrics });
    }

    if (action === 'report') {
      if (!windowId) {
        return jsonResponse({ ok: false, error: 'windowId required for report action' }, 400);
      }
      const reservations = await runWithDbClient(admin, () =>
        runInServerPairingContext(() => fetchReservationsForWindow(windowId!)),
      );
      return jsonResponse({ ok: true, reservations });
    }

    if (action === 'seedActiveDate') {
      if (!windowId || !userAId || !userBId) {
        return jsonResponse(
          { ok: false, error: 'windowId, userAId, and userBId required for seedActiveDate' },
          400,
        );
      }
      const { data, error } = await admin.rpc('seed_active_speed_date_ending_soon', {
        p_window_id: windowId,
        p_user_a_id: userAId,
        p_user_b_id: userBId,
        p_seconds_remaining: secondsRemaining ?? 30,
      });
      if (error) {
        return jsonResponse({ ok: false, error: error.message, seedSpeedDateResult: { ok: false, error: error.message } });
      }
      return jsonResponse({
        ok: true,
        seedSpeedDateResult: { ok: true, speedDateId: data as string },
      });
    }

    if (action === 'endSpeedDate') {
      if (!speedDateId) {
        return jsonResponse({ ok: false, error: 'speedDateId required for endSpeedDate action' }, 400);
      }
      const { data, error } = await admin.rpc('end_speed_date_return_to_queue', {
        p_speed_date_id: speedDateId,
      });
      if (error) {
        return jsonResponse({ ok: false, error: error.message, endSpeedDateResult: { ok: false, error: error.message } });
      }
      return jsonResponse({ ok: true, endSpeedDateResult: data as Record<string, unknown> });
    }

    if (mode === 'plan') {
      if (!windowId) {
        return jsonResponse({ ok: false, error: 'windowId required for plan mode' }, 400);
      }
      const planRun = await runWithDbClient(admin, () =>
        runInServerPairingContext(() =>
          runPlanPairsForWindowWithCoordinator(windowId!, 'edge_function'),
        ),
      );
      return jsonResponse({
        ok: true,
        windowsScanned: 1,
        planRuns: [
          {
            windowId: planRun.windowId,
            candidatesConsidered: planRun.candidatesConsidered,
            reservationsCreated: planRun.outcome.reservationsCreated,
            immediateCommits: planRun.outcome.immediateCommits,
            waitingCandidates: planRun.outcome.waitingCandidates,
            availableSoonCandidates: planRun.outcome.availableSoonCandidates,
            reservationIds: planRun.outcome.reservationIds,
            unmatched: planRun.outcome.unmatchedUserIds.length,
            skipped: planRun.outcome.skippedPairs.length,
            skippedLock: planRun.skippedLock ?? false,
            topScores: planRun.outcome.evaluatedPairs?.slice(0, 5) ?? [],
          },
        ],
      });
    }

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
