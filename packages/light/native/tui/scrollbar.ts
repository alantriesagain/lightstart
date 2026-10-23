/**
 * @bootstrapp/light/native/tui/scrollbar: the scrollbar a `LineView` draws in its
 * last cell: where the thumb sits for a scroll position, and the scroll
 * position a place of the thumb stands for. Measured in half rows, drawn
 * with box drawing's half-heavy lines (`╽` `╿`), so the thumb moves half a
 * row at a time.
 */

/** The thumb over a track, in half rows: where it starts and how long it is (0 when every line fits). */
export class Thumb {
  start = 0;
  length = 0;
}

/** The thumb for `count` lines shown from line `top` in `rows` rows. */
export const thumbOf = (rows: number, count: number, top: number): Thumb => {
  const t = new Thumb();
  if (rows <= 0 || count <= rows) return t;
  const span = rows * 2;
  t.length = Math.max(2, Math.min(span - 1, Math.round((span * rows) / count)));
  const max = count - rows;
  t.start = Math.round(((span - t.length) * Math.max(0, Math.min(max, top))) / max);
  return t;
};

/** The first line shown when the thumb starts at half row `start`. */
export const topAt = (rows: number, count: number, start: number): number => {
  const t = thumbOf(rows, count, 0);
  const room = rows * 2 - t.length;
  if (t.length === 0 || room <= 0) return 0;
  return Math.round((Math.max(0, Math.min(room, start)) * (count - rows)) / room);
};

/** Row `row`'s cell of the bar: the track, the thumb, or the thumb's end in one half. */
export const barCell = (t: Thumb, row: number): string => {
  const upper = 2 * row >= t.start && 2 * row < t.start + t.length;
  const lower = 2 * row + 1 >= t.start && 2 * row + 1 < t.start + t.length;
  if (upper && lower) return "┃";
  if (upper) return "╿";
  if (lower) return "╽";
  return "│";
};
