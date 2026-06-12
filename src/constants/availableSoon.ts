/** Seconds remaining on an active date before a user enters the Available Soon pool. */
export const AVAILABLE_SOON_THRESHOLD_SECONDS = 60;

/** Server-side speed date length (production). Dev helpers backdate started_at for testing. */
export const SPEED_DATE_DURATION_SECONDS = 300;

/** Extra buffer added to reservation TTL when planning with available-soon users. */
export const RESERVATION_AVAILABILITY_BUFFER_SECONDS = 30;
