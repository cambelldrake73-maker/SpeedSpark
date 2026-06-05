import type { AccountStatus, ReportContext, ReportStatus, SafetyReport } from '../types/safety';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { blockUserInSupabase } from './blocks';
import { isSupabaseConfigured, requireSupabase } from './supabase';
import { updateSpeedDateStatus } from './speedDates';

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_id: string;
  context: ReportContext;
  speed_date_id: string | null;
  notes: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapReportRow(row: ReportRow): SafetyReport {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reportedId: row.reported_id,
    context: row.context,
    speedDateId: row.speed_date_id,
    notes: row.notes,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchAccountStatus(userId: string): Promise<AccountStatus> {
  if (!isSupabaseConfigured) {
    return 'active';
  }

  const op = 'profiles.selectAccountStatus';
  logSupabaseRequest(op, { userId });

  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('account_status')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throwSupabaseError(op, error);
  }

  return ((data as { account_status?: AccountStatus } | null)?.account_status ??
    'active') as AccountStatus;
}

export function isParticipationAllowedStatus(status: AccountStatus): boolean {
  return status === 'active';
}

export async function assertAccountCanParticipate(userId: string): Promise<void> {
  const status = await fetchAccountStatus(userId);
  if (!isParticipationAllowedStatus(status)) {
    throw new Error('This account cannot join speed dates or send messages right now.');
  }
}

export async function requestAccountDeletion(): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  const op = 'rpc.request_account_deletion';
  logSupabaseRequest(op);

  const { error } = await requireSupabase().rpc('request_account_deletion');
  if (error) {
    throwSupabaseError(op, error);
  }
}

export async function blockUserWithSafety(
  blockerId: string,
  blockedId: string,
  options?: { speedDateId?: string },
): Promise<void> {
  await blockUserInSupabase(blockerId, blockedId);

  if (options?.speedDateId && isSupabaseConfigured) {
    await updateSpeedDateStatus(options.speedDateId, 'cancelled');
  }
}

export async function reportUser(input: {
  reporterId: string;
  reportedUserId: string;
  context: ReportContext;
  notes?: string;
  speedDateId?: string;
}): Promise<SafetyReport> {
  if (!isSupabaseConfigured) {
    throw new Error('Reporting requires Supabase configuration.');
  }

  if (input.reporterId === input.reportedUserId) {
    throw new Error('You cannot report yourself.');
  }

  const op = 'reports.insert';
  logSupabaseRequest(op, {
    reporterId: input.reporterId,
    reportedUserId: input.reportedUserId,
    context: input.context,
  });

  const { data, error } = await requireSupabase()
    .from('reports')
    .insert({
      reporter_id: input.reporterId,
      reported_id: input.reportedUserId,
      context: input.context,
      speed_date_id: input.speedDateId ?? null,
      notes: input.notes?.trim() || null,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    throwSupabaseError(op, error);
  }

  return mapReportRow(data as ReportRow);
}

/** Requires service role client via dbClient override — not available from the mobile app. */
export async function fetchReportsForAdmin(): Promise<SafetyReport[]> {
  const { resolveDbClient } = await import('./dbClient');
  const op = 'reports.selectAdmin';
  logSupabaseRequest(op);

  const { data, error } = await resolveDbClient()
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throwSupabaseError(op, error);
  }

  return ((data ?? []) as ReportRow[]).map(mapReportRow);
}

/** Requires service role client via dbClient override — not available from the mobile app. */
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  adminNotes?: string,
): Promise<SafetyReport> {
  const { resolveDbClient } = await import('./dbClient');
  const op = 'reports.updateStatus';
  logSupabaseRequest(op, { reportId, status });

  const { data, error } = await resolveDbClient()
    .from('reports')
    .update({
      status,
      admin_notes: adminNotes?.trim() || null,
    })
    .eq('id', reportId)
    .select('*')
    .single();

  if (error) {
    throwSupabaseError(op, error);
  }

  return mapReportRow(data as ReportRow);
}
