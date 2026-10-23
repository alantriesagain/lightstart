/**
 * @bootstrapp/light/components/utils/time-ago
 *
 * How long ago, in the reader's language. `Intl.RelativeTimeFormat` owns the
 * words, so this module has none of its own and needs no locale file.
 */

/** @type {Array<[Intl.RelativeTimeFormatUnit, number]>} */
const UNITS = [
  ["year", 365 * 86400e3],
  ["month", 30 * 86400e3],
  ["week", 7 * 86400e3],
  ["day", 86400e3],
  ["hour", 3600e3],
  ["minute", 60e3],
];

/**
 * A timestamp as a phrase: "2 hours ago", "há 2 horas". Anything under a minute
 * is the locale's word for now, and an unreadable timestamp answers nothing
 * rather than a wrong number.
 *
 * @param {string} iso
 * @param {string} [locale]
 * @param {number} [now]
 * @returns {string}
 */
export const timeAgo = (iso, locale = "en", now = Date.now()) => {
  const at = Date.parse(iso || "");
  if (Number.isNaN(at)) return "";
  const elapsed = at - now;
  try {
    const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    for (const [unit, ms] of UNITS)
      if (Math.abs(elapsed) >= ms) return format.format(Math.round(elapsed / ms), unit);
    return format.format(0, "second");
  } catch {
    return "";
  }
};
