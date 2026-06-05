const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when dateId is a Supabase speed_dates row id (not demo `date-*`). */
export function isBackendSpeedDateId(dateId: string): boolean {
  return UUID_RE.test(dateId);
}
