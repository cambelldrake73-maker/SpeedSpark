import {
  contactVerificationCorsHeaders,
  createServiceClient,
  isContactVerificationConfigured,
  isValidDestination,
  jsonResponse,
  normalizeDestination,
  sendContactVerificationCode,
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

    if (channel !== 'sms' && channel !== 'call' && channel !== 'email') {
      return jsonResponse({ error: 'channel must be sms, call, or email' }, 400);
    }

    const destination = normalizeDestination(channel, destinationRaw);
    if (!isValidDestination(channel, destinationRaw)) {
      return jsonResponse({ error: 'Invalid destination for channel' }, 400);
    }

    const admin = createServiceClient(supabaseUrl, serviceRoleKey);
    const result = await sendContactVerificationCode(admin, channel, destination);

    const response: Record<string, unknown> = {
      ok: true,
      configured: true,
      channel,
      provider: result.provider,
    };

    if (result.devPreviewCode && Deno.env.get('CONTACT_VERIFY_DEV') === 'true') {
      response.devPreviewCode = result.devPreviewCode;
    }

    return jsonResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[send-contact-verification]', message);
    return jsonResponse({ error: message, configured: true }, 400);
  }
});
