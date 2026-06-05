import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  assertSpeedDateParticipant,
  corsHeaders,
  ensureCallRoom,
  getAuthenticatedUser,
  getLiveKitConfig,
  jsonResponse,
} from '../_shared/callRoom.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const livekit = getLiveKitConfig();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }
  if (!livekit) {
    return jsonResponse({ error: 'LiveKit is not configured' }, 500);
  }

  try {
    const user = await getAuthenticatedUser(req, supabaseUrl, anonKey);
    const body = await req.json();
    const speedDateId = typeof body?.speedDateId === 'string' ? body.speedDateId : '';
    if (!speedDateId) {
      return jsonResponse({ error: 'speedDateId is required' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await assertSpeedDateParticipant(admin, speedDateId, user.id);
    const callRow = await ensureCallRoom(admin, livekit, speedDateId);

    console.log('[create-call-room] ok', {
      speedDateId,
      roomName: callRow.room_name,
      userId: user.id,
    });

    return jsonResponse({
      ok: true,
      speedDateId,
      roomName: callRow.room_name,
      status: callRow.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'Unauthorized' || message.startsWith('Forbidden') ? 403 : 400;
    console.error('[create-call-room] failed', message);
    return jsonResponse({ ok: false, error: message }, status);
  }
});
