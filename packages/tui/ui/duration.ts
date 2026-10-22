/**
 * @file Durations as the views write them: a call's time, a running clock, and how long a turn took.
 */

/** A call's time: tenths under ten seconds, whole seconds under a minute, then minutes and seconds ("2m 05s"). */
export const span = (ms: number): string => {
  if (ms < 10000) return (Math.floor(ms / 100) / 10).toFixed(1) + "s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return String(s) + "s";
  return String(Math.floor(s / 60)) + "m " + (s % 60 < 10 ? "0" : "") + String(s % 60) + "s";
};

/** A running clock: whole seconds, then minutes and seconds ("2m 05s"). */
export const clock = (ms: number): string => {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return s < 60 ? String(s) + "s" : String(Math.floor(s / 60)) + "m " + (s % 60 < 10 ? "0" : "") + String(s % 60) + "s";
};

/** How long a turn took, as its footer says: tenths under a minute, then minutes and seconds ("2m 5s"). */
export const took = (ms: number): string => (ms >= 60000 ? String(Math.floor(ms / 60000)) + "m " + String(Math.round((ms % 60000) / 1000)) + "s" : (ms / 1000).toFixed(1) + "s");

/** The locale the date reads in: LC_ALL, else LC_TIME, else LANG ("" when none is set). */
const locale = (override: string | undefined): string => {
  if (override !== undefined) return override;
  const env = process.env;
  return env.LC_ALL ?? env.LC_TIME ?? env.LANG ?? "";
};

/** A message's stamp: the time then the date ("12:13:00 12/03/2026"), the date month first where the locale is the US (its own order elsewhere, the US when unknown). */
export const stamp = (ms: number, override?: string): string => {
  const d = new Date(ms);
  const p = (n: number): string => (n < 10 ? "0" : "") + String(n);
  const where = locale(override).toLowerCase();
  const us = where.length === 0 || /(^|[_-])us([.@]|$)/.test(where);
  const a = us ? d.getMonth() + 1 : d.getDate();
  const b = us ? d.getDate() : d.getMonth() + 1;
  return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()) + " " + p(a) + "/" + p(b) + "/" + String(d.getFullYear());
};
