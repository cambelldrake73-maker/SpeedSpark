import {
  contactVerificationCorsHeaders,
  createServiceClient,
  isContactVerificationConfigured,
  isValidDestination,
  jsonResponse,
  normalizeDestination,
  verifyContactVerificationCode,
  type VerificationChannel,
} from '../_shared/contactVerification.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: contactVerificationCorsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  if (!isContactVerificationConfigured()) {
    return jsonResponse(
      {
        error: 'Contact verification is not configured on the server.',
        configured: false,
      },
      503,
    );
  }

  try {
    const body = await req.json();
    const channel = body?.channel as VerificationChannel;
    const destinationRaw = typeof body?.destination === 'string' ? body.destination : '';
    const code = typeof body?.code === 'string' ? body.code : '';

    if (channel !== 'sms' && channel !== 'call' && channel !== 'email') {
      return jsonResponse({ error: 'channel must be sms, call, or email' }, 400);
    }

    const destination = normalizeDestination(channel, destinationRaw);
    if (!isValidDestination(channel, destinationRaw)) {
      return jsonResponse({ error: 'Invalid destination for channel' }, 400);
    }

    if (code.replace(/\D/g, '').length !== 6) {
      return jsonResponse({ error: 'Enter the full 6-digit code' }, 400);
    }

    const admin = createServiceClient(supabaseUrl, serviceRoleKey);
    const approved = await verifyContactVerificationCode(admin, channel, destination, code);

    if (!approved) {
      return jsonResponse({ ok: false, approved: false, error: 'Incorrect or expired code' }, 400);
    }

    return jsonResponse({ ok: true, approved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[verify-contact-code]', message);
    return jsonResponse({ error: message, configured: true }, 400);
  }
});
