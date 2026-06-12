import { NEUTRAL_MATCH_SCORE } from './matchingScoring';

/** Beta absolute floor — never accept mutual scores below this via wait policy. */
export const ABSOLUTE_MINIMUM_MUTUAL_SCORE = 40;

/** Reference “default strict” soft threshold for metrics (neutral score baseline). */
export const DEFAULT_SOFT_MUTUAL_SCORE = NEUTRAL_MATCH_SCORE;

/** When available-soon users lack queue joined_at, assume normal wait for policy. */
export const AVAILABLE_SOON_DEFAULT_WAIT_SECONDS = 90;

export const WAIT_BUCKET_FRESH_MAX_SECONDS = 60;
export const WAIT_BUCKET_NORMAL_MAX_SECONDS = 180;
export const WAIT_BUCKET_LONG_MAX_SECONDS = 300;

export type WaitBucket = 'fresh' | 'normal' | 'long' | 'extended';
export type PoolBucket = 'tiny' | 'small' | 'medium' | 'large';

/**
 * Minimum mutual score by wait bucket × pool bucket.
 * Hard gates still apply separately — this is soft-score floor only.
 */
export const MINIMUM_MUTUAL_SCORE_MATRIX: Record<WaitBucket, Record<PoolBucket, number>> = {
  fresh: { tiny: 60, small: 60, medium: 65, large: 70 },
  normal: { tiny: 55, small: 55, medium: 60, large: 65 },
  long: { tiny: 45, small: 48, medium: 50, large: 55 },
  extended: { tiny: 40, small: 42, medium: 45, large: 50 },
};
