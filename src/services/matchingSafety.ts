import { isDbAvailable, resolveDbClient } from './dbClient';

function pairKey(userAId: string, userBId: string): string {
  return [userAId, userBId].sort().join(':');
}

/** Pair keys where a waiting user has reported another waiting user. */
export async function fetchReportedPairKeys(userIds: string[]): Promise<Set<string>> {
  const keys = new Set<string>();
  if (!isDbAvailable() || userIds.length < 2) {
    return keys;
  }

  const candidateSet = new Set(userIds);

  await Promise.all(
    userIds.map(async (reporterId) => {
      const others = userIds.filter((id) => id !== reporterId);
      if (others.length === 0) {
        return;
      }

      const { data, error } = await resolveDbClient()
        .from('reports')
        .select('reporter_id, reported_id')
        .eq('reporter_id', reporterId)
        .in('reported_id', others);

      if (error || !data) {
        return;
      }

      for (const row of data as Array<{ reporter_id: string; reported_id: string }>) {
        if (candidateSet.has(row.reporter_id) && candidateSet.has(row.reported_id)) {
          keys.add(pairKey(row.reporter_id, row.reported_id));
        }
      }
    }),
  );

  return keys;
}
