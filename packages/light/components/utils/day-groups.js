/**
 * @bootstrapp/light/components/utils/day-groups
 *
 * Dated entries as the reader's days, and an instant's time of day as the reader
 * writes it. A day is the calendar date the instant falls on in the reader's
 * zone, and a date with no time is that day as given. `Intl` owns the words, so
 * this module has none of its own and needs no locale file.
 */

/** @import { TimelineDay, TimelineEntry, TimelineMoment } from "../types.ts" */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What an entry's `at` holds: an instant, a date alone, or nothing readable.
 * It never throws, whatever it is given.
 *
 * @param {string} at
 * @returns {TimelineMoment}
 */
export const readAt = (at) => {
  if (typeof at !== "string") return { kind: "unreadable" };
  if (DATE_ONLY.test(at)) return { kind: "date", day: at };
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return { kind: "unreadable" };
  return { kind: "instant", ms };
};

/**
 * @param {string} [timeZone]
 * @returns {Intl.DateTimeFormat}
 */
const dayFormat = (timeZone) =>
  new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * @param {Intl.DateTimeFormat} format
 * @param {number} ms
 * @returns {string}
 */
const keyIn = (format, ms) => {
  const parts = Object.fromEntries(format.formatToParts(ms).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/**
 * The calendar date `YYYY-MM-DD` an instant falls on in `timeZone`, the
 * reader's when omitted.
 *
 * @param {number} ms
 * @param {string} [timeZone]
 * @returns {string}
 */
export const dayKeyOf = (ms, timeZone) => keyIn(dayFormat(timeZone), ms);

/**
 * Entries grouped by day, newest day first and latest first within a day; a
 * date alone sorts as the start of its day, and entries at the same moment keep
 * their order. `oldestFirst` reverses both. Unreadable entries come last in one
 * group whose `day` is null, in either order.
 *
 * @param {TimelineEntry[]} entries
 * @param {{ oldestFirst?: boolean, timeZone?: string }} [options]
 * @returns {TimelineDay[]}
 */
export const groupByDay = (entries, { oldestFirst = false, timeZone } = {}) => {
  const format = dayFormat(timeZone);
  /** @type {Array<{ entry: TimelineEntry, day: string, ms: number }>} */
  const dated = [];
  /** @type {TimelineEntry[]} */
  const unreadable = [];
  for (const entry of entries) {
    const moment = readAt(entry.at);
    if (moment.kind === "unreadable") {
      unreadable.push(entry);
      continue;
    }
    if (moment.kind === "date") dated.push({ entry, day: moment.day, ms: -Infinity });
    else dated.push({ entry, day: keyIn(format, moment.ms), ms: moment.ms });
  }
  const direction = oldestFirst ? 1 : -1;
  dated.sort((a, b) => {
    if (a.day !== b.day) return (a.day < b.day ? -1 : 1) * direction;
    if (a.ms === b.ms) return 0;
    return (a.ms < b.ms ? -1 : 1) * direction;
  });
  /** @type {TimelineDay[]} */
  const days = [];
  for (const { entry, day } of dated) {
    const last = days.at(-1);
    if (last?.day === day) {
      last.entries.push(entry);
      continue;
    }
    days.push({ day, entries: [entry] });
  }
  if (unreadable.length) days.push({ day: null, entries: unreadable });
  return days;
};

/**
 * @param {string} day
 * @returns {number}
 */
const utcOf = (day) => {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
};

/**
 * @param {string} day
 * @param {string} locale
 * @param {string} today
 * @returns {string}
 */
const wordsIn = (day, locale, today) => {
  const offset = Math.round((utcOf(day) - utcOf(today)) / 86400e3);
  if (Math.abs(offset) <= 1) {
    const words = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(offset, "day");
    return words.charAt(0).toLocaleUpperCase(locale) + words.slice(1);
  }
  /** @type {Intl.DateTimeFormatOptions} */
  const options = { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" };
  if (day.slice(0, 4) !== today.slice(0, 4)) options.year = "numeric";
  return new Intl.DateTimeFormat(locale, options).format(utcOf(day));
};

/**
 * @param {(locale: string) => string} words
 * @param {string} locale
 * @returns {string}
 */
const inLocale = (words, locale) => {
  try {
    return words(locale);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return words("en");
  }
};

/**
 * A day's heading in the reader's language: "Today", "Yesterday" and
 * "Tomorrow" around `today`, the weekday and date otherwise, with the year only
 * when it is not this one. An unknown locale reads as English.
 *
 * @param {string} day
 * @param {string} locale
 * @param {string} today
 * @returns {string}
 */
export const dayWords = (day, locale, today) => inLocale((tag) => wordsIn(day, tag, today), locale);

/**
 * An instant's time of day, short, in the reader's language. An unknown locale
 * reads as English.
 *
 * @param {number} ms
 * @param {string} locale
 * @returns {string}
 */
export const timeWords = (ms, locale) =>
  inLocale((tag) => new Date(ms).toLocaleTimeString(tag, { timeStyle: "short" }), locale);
