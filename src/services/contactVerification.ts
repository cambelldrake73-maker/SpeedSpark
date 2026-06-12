import { requireSupabase, isSupabaseConfigured } from './supabase';

export type ContactVerificationChannel = 'sms' | 'call' | 'email';

export interface SendContactVerificationResult {
  ok: boolean;
  configured: boolean;
  provider?: 'twilio' | 'resend' | 'dev';
  devPreviewCode?: string;
  error?: string;
}

export interface VerifyContactCodeResult {
  ok: boolean;
  approved: boolean;
  configured: boolean;
  error?: string;
}

function mapMethodToChannel(
  method: 'phone' | 'email',
  delivery: 'sms' | 'call' = 'sms',
): ContactVerificationChannel {
  if (method === 'email') {
    return 'email';
  }
  return delivery;
}

async function invokeContactFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke(functionName, { body });

  if (error) {
    throw new Error(error.message ?? `Failed to invoke ${functionName}`);
  }

  return data as T;
}

export async function sendContactVerificationCode(input: {
  method: 'phone' | 'email';
  destination: string;
  delivery?: 'sms' | 'call';
}): Promise<SendContactVerificationResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, configured: false, error: 'Supabase is not configured' };
  }

  const channel = mapMethodToChannel(input.method, input.delivery ?? 'sms');
  const data = await invokeContactFunction<SendContactVerificationResult>(
    'send-contact-verification',
    { channel, destination: input.destination.trim() },
  );

  if (data.error) {
    return { ...data, ok: false, configured: data.configured ?? true };
  }

  return { ...data, ok: true, configured: data.configured ?? true };
}

export async function verifyContactCode(input: {
  method: 'phone' | 'email';
  destination: string;
  code: string;
  delivery?: 'sms' | 'call';
}): Promise<VerifyContactCodeResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, approved: false, configured: false, error: 'Supabase is not configured' };
  }

  const channel = mapMethodToChannel(input.method, input.delivery ?? 'sms');
  const data = await invokeContactFunction<VerifyContactCodeResult & { approved?: boolean }>(
    'verify-contact-code',
    {
      channel,
      destination: input.destination.trim(),
      code: input.code,
    },
  );

  if (data.approved) {
    return { ok: true, approved: true, configured: true };
  }

  return {
    ok: false,
    approved: false,
    configured: data.configured ?? true,
    error: data.error ?? 'Incorrect or expired code',
  };
}