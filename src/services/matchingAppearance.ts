import { logBackendInfo } from './backendLogger';
import { isDbAvailable, resolveDbClient } from './dbClient';

const NEUTRAL_APPEARANCE_SCORE = 50;

/**
 * Private appearance fit from prior date_feedback only.
 * Never exposed in UI — used internally for weighted matching.
 */
export async function fetchAppearanceFitScores(
  viewerId: string,
  partnerIds: string[],
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  for (const partnerId of partnerIds) {
    scores.set(partnerId, NEUTRAL_APPEARANCE_SCORE);
  }

  if (!isDbAvailable() || partnerIds.length === 0) {
    return scores;
  }

  const { data, error } = await resolveDbClient()
    .from('date_feedback')
    .select('partner_id, attractiveness_rating')
    .eq('rater_id', viewerId)
    .in('partner_id', partnerIds);

  if (error) {
    logBackendInfo('matching.appearance.loadFailed', { viewerId, message: error.message });
    return scores;
  }

  for (const row of (data ?? []) as Array<{ partner_id: string; attractiveness_rating: number }>) {
    const normalized = Math.max(0, Math.min(100, row.attractiveness_rating * 10));
    scores.set(row.partner_id, normalized);
  }

  logBackendInfo('matching.appearance.loaded', {
    viewerId,
    partners: partnerIds.length,
    rated: (data ?? []).length,
  });

  return scores;
}

export { NEUTRAL_APPEARANCE_SCORE };
