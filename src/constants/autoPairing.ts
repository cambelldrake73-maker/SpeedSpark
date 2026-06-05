/** How often the auto-pairing worker scans live windows (milliseconds). */
export const AUTO_PAIRING_INTERVAL_MS = 15_000;

/** Distributed lock TTL — should be slightly less than interval to avoid overlap stalls. */
export const PAIRING_LOCK_TTL_SECONDS = 25;

/** Minimum waiting users before a pairing run is attempted. */
export const PAIRING_MIN_WAITING_USERS = 2;
