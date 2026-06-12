import type { MatchingPriorityCategory } from '../types';

export const MATCHING_PRIORITY_CATEGORIES: MatchingPriorityCategory[] = [
  'datingIntentionFit',
  'presentationFit',
  'ageFit',
  'distanceFit',
  'appearanceFit',
  'lifestyleFit',
  'heightFit',
];

export const DEFAULT_MATCHING_PRIORITY_ORDER: MatchingPriorityCategory[] = [
  'datingIntentionFit',
  'presentationFit',
  'ageFit',
  'distanceFit',
  'appearanceFit',
  'lifestyleFit',
  'heightFit',
];

/** User-facing labels — never expose raw appearance scores. */
export const MATCHING_PRIORITY_LABELS: Record<MatchingPriorityCategory, string> = {
  datingIntentionFit: 'Dating intentions',
  presentationFit: 'Presentation',
  ageFit: 'Age range',
  distanceFit: 'Distance',
  appearanceFit: 'Attractiveness',
  lifestyleFit: 'Lifestyle & values',
  heightFit: 'Height',
};

export const MATCHING_PRIORITY_HINTS: Record<MatchingPriorityCategory, string> = {
  datingIntentionFit: 'Relationship goals and what you are looking for',
  presentationFit: 'Presentation and vibe overlap',
  ageFit: 'How closely age matches your range',
  distanceFit: 'Geographic proximity',
  appearanceFit: 'Your private post-date attractiveness ratings — never shown on profiles',
  lifestyleFit: 'Shared lifestyle & values tags',
  heightFit: 'Height relative to your preferred range',
};

export function normalizeMatchingPriorityOrder(
  order: string[] | null | undefined,
): MatchingPriorityCategory[] {
  const seen = new Set<MatchingPriorityCategory>();
  const normalized: MatchingPriorityCategory[] = [];

  for (const key of order ?? []) {
    if (!MATCHING_PRIORITY_CATEGORIES.includes(key as MatchingPriorityCategory)) {
      continue;
    }
    const category = key as MatchingPriorityCategory;
    if (seen.has(category)) {
      continue;
    }
    seen.add(category);
    normalized.push(category);
  }

  for (const category of DEFAULT_MATCHING_PRIORITY_ORDER) {
    if (!seen.has(category)) {
      normalized.push(category);
    }
  }

  return normalized;
}

/**
 * Rank position 0 (most important) receives the highest weight.
 * Weights are normalized to sum to 1.
 */
export function priorityWeights(
  order: MatchingPriorityCategory[],
): Record<MatchingPriorityCategory, number> {
  const n = order.length;
  const weights = {} as Record<MatchingPriorityCategory, number>;
  let sum = 0;

  order.forEach((category, index) => {
    const weight = n - index;
    weights[category] = weight;
    sum += weight;
  });

  for (const category of MATCHING_PRIORITY_CATEGORIES) {
    weights[category] = (weights[category] ?? 1) / sum;
  }

  return weights;
}

export function movePriorityItem(
  order: MatchingPriorityCategory[],
  index: number,
  direction: 'up' | 'down',
): MatchingPriorityCategory[] {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= order.length) {
    return order;
  }

  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
