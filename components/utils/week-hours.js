/**
 * A week of opening hours, as data. A day is numbered the way `Date#getDay`
 * numbers it, 0 Sunday to 6 Saturday. An entry is the days that keep the same
 * hours, `open` and `close` as `HH:MM`; a close at or before the open runs past
 * midnight into the next day. A day in no entry is closed. Pure, so a server
 * and a test read hours the same way the control writes them.
 */

/** @import { WeekHoursDay, WeekHoursEntry } from "../types.ts" */

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Whether a value is a time of day as `HH:MM`.
 * @param {unknown} value
 * @returns {value is string}
 */
export const isClock = (value) => typeof value === "string" && CLOCK.test(value);

/**
 * The week in the order a reader lists it, starting on `firstDay`.
 * @type {(firstDay?: number) => number[]}
 */
export const weekOrder = (firstDay = 1) => Array.from({ length: 7 }, (_, i) => (((firstDay % 7) + 7 + i) % 7));

const MONDAY_FIRST = weekOrder(1);

/**
 * Each day's hours, Sunday first, or null for a day closed. Anything that is
 * not a valid entry is left out, and a day named twice keeps its last hours.
 * @type {(value: unknown) => Array<WeekHoursDay | null>}
 */
export const expandWeek = (value) => {
  /** @type {Array<WeekHoursDay | null>} */
  const week = Array(7).fill(null);
  if (!Array.isArray(value)) return week;
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || !isClock(entry.open) || !isClock(entry.close) || !Array.isArray(entry.days)) continue;
    for (const day of entry.days)
      if (Number.isInteger(day) && day >= 0 && day <= 6) week[day] = { open: entry.open, close: entry.close };
  }
  return week;
};

/**
 * The week as entries: the days sharing hours together, Monday first within
 * an entry and entry by entry.
 * @type {(week: Array<WeekHoursDay | null>) => WeekHoursEntry[]}
 */
export const groupWeek = (week) => {
  /** @type {Map<string, WeekHoursEntry>} */
  const groups = new Map();
  for (const day of MONDAY_FIRST) {
    const hours = week[day];
    if (!hours || !isClock(hours.open) || !isClock(hours.close)) continue;
    const key = `${hours.open}-${hours.close}`;
    const entry = groups.get(key);
    if (entry) entry.days.push(day);
    else groups.set(key, { days: [day], open: hours.open, close: hours.close });
  }
  return [...groups.values()];
};

/**
 * Whether the hours of a day run past midnight.
 * @type {(hours: WeekHoursDay) => boolean}
 */
export const pastMidnight = (hours) => hours.close <= hours.open;
