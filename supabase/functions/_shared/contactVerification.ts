import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const contactVerificationCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export type VerificationChannel = 'sms' | 'call' | 'email';

export function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...contactVerificationCorsHeaders, 'Content-Type': 'application/json' },
  });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** US-first E.164; pass through values that already include + */
export function normalizePhoneE164(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

export function normalizeDestination(channel: VerificationChannel, destination: string): string {
  return channel === 'email' ? normalizeEmail(destination) : normalizePhoneE164(destination);
}

export function isValidDestination(channel: VerificationChannel, destination: string): boolean {
  if (channel === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(destination));
  }
  const e164 = normalizePhoneE164(destination);
  return /^\+\d{10,15}$/.test(e164);
}

function getTwilioConfig() {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')?.trim();
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')?.trim();
  const verifyServiceSid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID')?.trim();
  if (!accountSid || !authToken || !verifyServiceSid) {
    return null;
  }
  return { accountSid, authToken, verifyServiceSid };
}

function getResendConfig() {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const from = Deno.env.get('RESEND_FROM_EMAIL')?.trim() ?? 'SpeedSpark <onboarding@resend.dev>';
  if (!apiKey) {
    return null;
  }
  return { apiKey, from };
}

function twilioAuthHeader(accountSid: string, authToken: string): string {
  return `Basic ${btoa(`${accountSid}:${authToken}`)}`;
}

async function twilioFormPost(
  url: string,
  accountSid: string,
  authToken: string,
  fields: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: twilioAuthHeader(accountSid, authToken),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields),
  });
  const data = (await response.json()) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

export async function startTwilioVerification(
  to: string,
  channel: VerificationChannel,
): Promise<{ sid: string }> {
  const twilio = getTwilioConfig();
  if (!twilio) {
    throw new Error('Twilio Verify is not configured');
  }

  const twilioChannel = channel === 'call' ? 'call' : channel === 'email' ? 'email' : 'sms';
  const url = `https://verify.twilio.com/v2/Services/${twilio.verifyServiceSid}/Verifications`;
  const result = await twilioFormPost(url, twilio.accountSid, twilio.authToken, {
    To: to,
    Channel: twilioChannel,
  });

  if (!result.ok) {
    const message =
      typeof result.data.message === 'string' ? result.data.message : 'Twilio Verify send failed';
    throw new Error(message);
  }

  const sid = typeof result.data.sid === 'string' ? result.data.sid : '';
  if (!sid) {
    throw new Error('Twilio Verify did not return a verification sid');
  }
  return { sid };
}

export async function checkTwilioVerification(to: string, code: string): Promise<boolean> {
  const twilio = getTwilioConfig();
  if (!twilio) {
    throw new Error('Twilio Verify is not configured');
  }

  const url = `https://verify.twilio.com/v2/Services/${twilio.verifyServiceSid}/VerificationCheck`;
  const result = await twilioFormPost(url, twilio.accountSid, twilio.authToken, {
    To: to,
    Code: code.replace(/\D/g, ''),
  });

  if (!result.ok) {
    return false;
  }
  return result.data.status === 'approved';
}

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sendResendEmail(to: string, code: string): Promise<void> {
  const resend = getResendConfig();
  if (!resend) {
    throw new Error('Resend is not configured for email verification');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resend.from,
      to: [to],
      subject: 'Your SpeedSpark verification code',
      html: `<p>Your SpeedSpark verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed (${response.status}): ${body.slice(0, 200)}`);
  }
}

export function isContactVerificationConfigured(): boolean {
  return Boolean(getTwilioConfig() || getResendConfig() || Deno.env.get('CONTACT_VERIFY_DEV') === 'true');
}

export async function enforceSendRateLimit(
  admin: SupabaseClient,
  destination: string,
  channel: VerificationChannel,
): Promise<void> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from('contact_verification_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('destination_normalized', destination)
    .eq('channel', channel)
    .gte('created_at', since);

  if (error) {
    console.error('[contact-verification] rate limit check failed', error.message);
    return;
  }
  if ((count ?? 0) >= 5) {
    throw new Error('Too many codes sent. Wait an hour and try again.');
  }
}

export async function sendContactVerificationCode(
  admin: SupabaseClient,
  channel: VerificationChannel,
  destination: string,
): Promise<{ provider: 'twilio' | 'resend' | 'dev'; devPreviewCode?: string }> {
  await enforceSendRateLimit(admin, destination, channel);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const twilio = getTwilioConfig();
  const resend = getResendConfig();
  const devMode = Deno.env.get('CONTACT_VERIFY_DEV') === 'true';

  if (channel === 'email') {
    if (twilio) {
      try {
        const { sid } = await startTwilioVerification(destination, 'email');
        await admin.from('contact_verification_challenges').insert({
          destination_normalized: destination,
          channel,
          provider: 'twilio',
          provider_sid: sid,
          expires_at: expiresAt,
        });
        return { provider: 'twilio' };
      } catch (error) {
        console.warn('[contact-verification] Twilio email failed, trying Resend', error);
      }
    }

    if (resend) {
      const code = generateSixDigitCode();
      await sendResendEmail(destination, code);
      const codeHash = await hashCode(code);
      await admin.from('contact_verification_challenges').insert({
        destination_normalized: destination,
        channel,
        provider: 'resend',
        code_hash: codeHash,
        expires_at: expiresAt,
      });
      return { provider: 'resend' };
    }
  } else if (twilio) {
    const { sid } = await startTwilioVerification(destination, channel);
    await admin.from('contact_verification_challenges').insert({
      destination_normalized: destination,
      channel,
      provider: 'twilio',
      provider_sid: sid,
      expires_at: expiresAt,
    });
    return { provider: 'twilio' };
  }

  if (!devMode) {
    throw new Error(
      'Contact verification is not configured. Set Twilio Verify secrets (and Resend for email fallback).',
    );
  }

  const code = generateSixDigitCode();
  const codeHash = await hashCode(code);
  await admin.from('contact_verification_challenges').insert({
    destination_normalized: destination,
    channel,
    provider: 'dev',
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  console.log('[contact-verification][DEV] code for', destination, code);
  return { provider: 'dev', devPreviewCode: code };
}

export async function verifyContactVerificationCode(
  admin: SupabaseClient,
  channel: VerificationChannel,
  destination: string,
  code: string,
): Promise<boolean> {
  const normalizedCode = code.replace(/\D/g, '');
  if (normalizedCode.length !== 6) {
    return false;
  }

  const { data: challenge, error } = await admin
    .from('contact_verification_challenges')
    .select('id, provider, provider_sid, code_hash, expires_at, verified_at, verify_attempts')
    .eq('destination_normalized', destination)
    .eq('channel', channel)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !challenge) {
    return false;
  }

  const row = challenge as {
    id: string;
    provider: string;
    code_hash: string | null;
    expires_at: string;
    verified_at: string | null;
    verify_attempts: number;
  };

  if (row.verify_attempts >= 5) {
    throw new Error('Too many incorrect attempts. Request a new code.');
  }

  await admin
    .from('contact_verification_challenges')
    .update({ verify_attempts: row.verify_attempts + 1 })
    .eq('id', row.id);

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return false;
  }

  let approved = false;
  if (row.provider === 'twilio') {
    approved = await checkTwilioVerification(destination, normalizedCode);
  } else if (row.code_hash) {
    const codeHash = await hashCode(normalizedCode);
    approved = codeHash === row.code_hash;
  }

  if (approved) {
    await admin
      .from('contact_verification_challenges')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', row.id);
  }

  return approved;
}

export function createServiceClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
