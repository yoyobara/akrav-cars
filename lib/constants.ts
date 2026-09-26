/** Tunables from SPEC §4. */

/** A booking may be started from 30 min before its planned start ... */
export const START_GRACE_BEFORE_MIN = 30;
/** ... until 2 h after it. */
export const START_GRACE_AFTER_MIN = 120;

/** An approved booking starting within this window makes a car "Reserved". */
export const RESERVED_WINDOW_MIN = 60;

/** Parking history shown on the car detail screen (SPEC §5.2). */
export const PARKING_HISTORY_LIMIT = 10;
