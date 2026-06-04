const LOG_PREFIX = '[SpeedSpark Supabase]';

export type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number | string;
};

/** Log before a Supabase auth or REST request. */
export function logSupabaseRequest(
  operation: string,
  detail?: Record<string, unknown> | unknown,
): void {
  console.log(`${LOG_PREFIX} → ${operation}`, detail ?? '');
}

/** Log a failed request with the full error object and common Supabase fields. */
export function logSupabaseError(operation: string, error: unknown): void {
  console.error(`${LOG_PREFIX} ✗ ${operation}`, error);

  if (error && typeof error === 'object') {
    const e = error as SupabaseErrorLike;
    if (e.message !== undefined) {
      console.error(`${LOG_PREFIX}   message:`, e.message);
    }
    if (e.code !== undefined) {
      console.error(`${LOG_PREFIX}   code:`, e.code);
    }
    if (e.details !== undefined) {
      console.error(`${LOG_PREFIX}   details:`, e.details);
    }
    if (e.hint !== undefined) {
      console.error(`${LOG_PREFIX}   hint:`, e.hint);
    }
    if (e.status !== undefined) {
      console.error(`${LOG_PREFIX}   status:`, e.status);
    }
  }

  if (error instanceof Error && error.cause !== undefined) {
    console.error(`${LOG_PREFIX}   cause:`, error.cause);
  }
}

function readErrorMessage(error: unknown): string {
  if (!error) {
    return 'Unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as SupabaseErrorLike).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return String(error);
}

function readErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as SupabaseErrorLike).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function readErrorHint(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'hint' in error) {
    const hint = (error as SupabaseErrorLike).hint;
    return typeof hint === 'string' ? hint : undefined;
  }
  return undefined;
}

/** User-visible message: operation + message (+ code/hint when present). */
export function formatSupabaseError(error: unknown, operation?: string): string {
  const message = readErrorMessage(error);
  const code = readErrorCode(error);
  const hint = readErrorHint(error);

  const alreadyPrefixed = Boolean(
    operation &&
      (message.startsWith(`${operation}:`) || message.startsWith(`[${operation}]`)),
  );

  let text = alreadyPrefixed || !operation ? message : `${operation}: ${message}`;

  if (code && !text.includes(code)) {
    text = `${text} (${code})`;
  }
  if (hint && !text.toLowerCase().includes(hint.toLowerCase())) {
    text = `${text} — ${hint}`;
  }

  return text;
}

export function throwSupabaseError(operation: string, error: unknown): never {
  logSupabaseError(operation, error);
  const err = new Error(formatSupabaseError(error, operation));
  (err as Error & { cause?: unknown; operation?: string }).cause = error;
  (err as Error & { operation?: string }).operation = operation;
  throw err;
}

export async function runSupabaseRequest<T>(
  operation: string,
  detail: Record<string, unknown> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  logSupabaseRequest(operation, detail);
  try {
    const result = await fn();
    console.log(`${LOG_PREFIX} ✓ ${operation}`);
    return result;
  } catch (error) {
    throwSupabaseError(operation, error);
  }
}
