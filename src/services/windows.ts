import type { SpeedDateWindow } from '../types';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { isSupabaseConfigured, requireSupabase } from './supabase';
import { getQueueCounts } from './queueService';

interface WindowRow {
  id: string;
  label: string;
  description: string;
  start_time: string;
  end_time: string;
  timezone: string;
  is_live: boolean;
}

function mapWindowRow(row: WindowRow, queueCount?: number): SpeedDateWindow {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    timezone: row.timezone,
    isLive: row.is_live,
    queueCount,
  };
}

export async function fetchSpeedDateWindows(): Promise<SpeedDateWindow[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const op = 'speed_date_windows.select';
  logSupabaseRequest(op);

  const { data, error } = await requireSupabase()
    .from('speed_date_windows')
    .select('*')
    .order('start_time', { ascending: true });

  if (error) {
    throwSupabaseError(op, error);
  }

  const rows = (data ?? []) as WindowRow[];
  const windows = await Promise.all(
    rows.map(async (row) => {
      const counts = await getQueueCounts(row.id);
      return mapWindowRow(row, counts.waiting);
    }),
  );

  return windows;
}

export async function fetchLiveWindow(): Promise<SpeedDateWindow | null> {
  const windows = await fetchSpeedDateWindows();
  return windows.find((w) => w.isLive) ?? null;
}

export async function upsertSpeedDateWindow(
  window: Omit<SpeedDateWindow, 'queueCount'>,
): Promise<SpeedDateWindow> {
  const op = 'speed_date_windows.upsert';
  logSupabaseRequest(op, { label: window.label });

  const { data, error } = await requireSupabase()
    .from('speed_date_windows')
    .upsert({
      id: window.id,
      label: window.label,
      description: window.description,
      start_time: window.startTime,
      end_time: window.endTime,
      timezone: window.timezone,
      is_live: window.isLive,
    })
    .select('*')
    .single();

  if (error) {
    throwSupabaseError(op, error);
  }

  return mapWindowRow(data as WindowRow, 0);
}
