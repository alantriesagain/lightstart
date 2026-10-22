/**
 * @file A window of a file of lines (a transcript, JSON lines), read from its end backwards without
 * reading the rest: the lines that end before a byte offset, the window starting at a line
 * boundary, and grown when one line is longer than the window asked for. Lines starting with one
 * of the prefixes given are left out (records the reader never shows).
 */
import { closeSync, openSync, readSync, statSync } from "node:fs";

/** The widest window a read grows to when one line is longer than the window asked for. */
const MAX_SPAN = 128 * 1024 * 1024;

export class HistoryWindow {
  /** The lines of [start, end), oldest first, the lines skipped left out. */
  lines: string[] = [];
  /** Byte offsets in the file; `start` 0 means nothing is before this window. */
  start = 0;
  end = 0;
  size = 0;
}

/** `length` bytes of `fd` from `position` (fewer at the file's end). */
export const readAt = (fd: number, position: number, length: number): Buffer => {
  const buf = Buffer.alloc(length);
  const n = readSync(fd, buf, 0, length, position);
  return n < length ? buf.subarray(0, n) : buf;
};

/** A window of `path` ending at `before` (-1: the end, leaving out a line still being written). */
export const readWindow = (path: string, before: number, maxBytes: number, skip: string[]): HistoryWindow => {
  const w = new HistoryWindow();
  let size = 0;
  try {
    size = statSync(path).size;
  } catch {
    return w;
  }
  w.size = size;
  const end = before < 0 || before > size ? size : before;
  w.start = end;
  w.end = end;
  if (end === 0) return w;
  const fd = openSync(path, "r");
  try {
    let span = maxBytes > 0 ? maxBytes : 1;
    for (;;) {
      const start = end > span ? end - span : 0;
      const buf = readAt(fd, start, end - start);
      let from = 0;
      if (start > 0) {
        const nl = buf.indexOf(10);
        from = nl < 0 ? buf.length : nl + 1;
      }
      const last = buf.lastIndexOf(10);
      const to = last < from ? from : last + 1;
      if (to <= from && start > 0 && span < MAX_SPAN) {
        span *= 2;
        continue;
      }
      w.start = start + from;
      w.end = start + to;
      if (to > from)
        for (const line of buf.subarray(from, to).toString("utf8").split("\n")) {
          if (line.length === 0) continue;
          let skipped = false;
          for (const p of skip) if (line.startsWith(p)) skipped = true;
          if (!skipped) w.lines.push(line);
        }
      return w;
    }
  } finally {
    closeSync(fd);
  }
};
