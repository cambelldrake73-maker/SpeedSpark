import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { AccessToken, RoomServiceClient } from 'npm:livekit-server-sdk@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export interface LiveKitConfig {
  apiKey: string;
  apiSecret: string;
  url: string;
}

export function getLiveKitConfig(): LiveKitConfig | null {
  const apiKey = Deno.env.get('LIVEKIT_API_KEY')?.trim();
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')?.trim();
  const url = Deno.env.get('LIVEKIT_URL')?.trim();
  if (!apiKey || !apiSecret || !url) {
    return null;
  }
  return { apiKey, apiSecret, url };
}

export async function getAuthenticatedUser(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<User> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Unauthorized');
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error('Unauthorized');
  }
  return data.user;
}

export function roomNameForSpeedDate(speedDateId: string): string {
  return `speed-date-${speedDateId}`;
}

export async function assertSpeedDateParticipant(
  admin: SupabaseClient,
  speedDateId: string,
  userId: string,
): Promise<{ userAId: string; userBId: string; status: string }> {
  const { data, error } = await admin
    .from('speed_dates')
    .select('user_a_id, user_b_id, status')
    .eq('id', speedDateId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Speed date not found');
  }

  const row = data as { user_a_id: string; user_b_id: string; status: string };
  if (userId !== row.user_a_id && userId !== row.user_b_id) {
    throw new Error('Forbidden: not a participant');
  }

  if (row.status !== 'active') {
    throw new Error('Speed date is not active');
  }

  return { userAId: row.user_a_id, userBId: row.user_b_id, status: row.status };
}

export interface CallRow {
  id: string;
  speed_date_id: string;
  room_name: string;
  provider: string;
  provider_room_id: string | null;
  status: string;
}

export async function ensureCallRoom(
  admin: SupabaseClient,
  livekit: LiveKitConfig,
  speedDateId: string,
): Promise<CallRow> {
  const roomName = roomNameForSpeedDate(speedDateId);

  const { data: existing, error: selectError } = await admin
    .from('speed_date_calls')
    .select('*')
    .eq('speed_date_id', speedDateId)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existing) {
    return existing as CallRow;
  }

  const roomService = new RoomServiceClient(livekit.url, livekit.apiKey, livekit.apiSecret);
  let providerRoomId: string | null = null;

  try {
    const room = await roomService.createRoom({
      name: roomName,
      maxParticipants: 2,
      emptyTimeout: 360,
      departureTimeout: 30,
    });
    providerRoomId = room.sid ?? null;
    console.log('[call-room] room created', { speedDateId, roomName, sid: providerRoomId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('already exists')) {
      throw error;
    }
    console.log('[call-room] room already exists in LiveKit', { roomName });
  }

  const { data: inserted, error: insertError } = await admin
    .from('speed_date_calls')
    .insert({
      speed_date_id: speedDateId,
      room_name: roomName,
      provider: 'livekit',
      provider_room_id: providerRoomId,
      status: 'pending',
    })
    .select('*')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raced } = await admin
        .from('speed_date_calls')
        .select('*')
        .eq('speed_date_id', speedDateId)
        .single();
      if (raced) {
        return raced as CallRow;
      }
    }
    throw new Error(insertError.message);
  }

  return inserted as CallRow;
}

export function mintVoiceToken(
  livekit: LiveKitConfig,
  roomName: string,
  identity: string,
  ttlSeconds = 360,
): { token: string; expiresAt: string } {
  const token = new AccessToken(livekit.apiKey, livekit.apiSecret, {
    identity,
    ttl: `${ttlSeconds}s`,
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });

  const jwt = token.toJwt();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  return { token: jwt, expiresAt };
}

export async function markCallActive(admin: SupabaseClient, speedDateId: string): Promise<void> {
  const { error } = await admin
    .from('speed_date_calls')
    .update({
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .eq('speed_date_id', speedDateId)
    .in('status', ['pending', 'active']);

  if (error) {
    throw new Error(error.message);
  }
}
