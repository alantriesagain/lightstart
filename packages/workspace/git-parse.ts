/**
 * @file The parsers of git's NUL-separated listings, shared by the changes bar, the Git tab and the
 * code column: `diff --numstat -z` (lines added and removed by path, "-" for a binary file) and
 * `--name-status -z --no-renames` (a status letter, then the path).
 *
 * In a rename's numstat line the counts' path is empty, and the source and destination follow.
 */

export class LineCount {
  added = 0;
  removed = 0;
  binary = false;
}

/** `diff --numstat -z` output by path; a binary file's counts are "-". */
export const parseNumstat = (text: string): Map<string, LineCount> => {
  const out = new Map<string, LineCount>();
  const fields = text.split("\0");
  let i = 0;
  while (i < fields.length) {
    const f = fields[i];
    i++;
    if (f.length === 0) continue;
    const parts = f.split("\t");
    if (parts.length < 3) continue;
    let path = parts.slice(2).join("\t");
    if (path.length === 0) {
      path = i + 1 < fields.length ? fields[i + 1] : "";
      i += 2;
    }
    const c = new LineCount();
    c.binary = parts[0] === "-";
    c.added = c.binary ? 0 : Number(parts[0]);
    c.removed = c.binary ? 0 : Number(parts[1]);
    if (path.length > 0) out.set(path, c);
  }
  return out;
};

/** `--name-status -z --no-renames` output: status letter, then path. */
export const parseNameStatus = (text: string): Map<string, string> => {
  const out = new Map<string, string>();
  const f = text.split("\0");
  for (let i = 0; i + 1 < f.length; i += 2) if (f[i].length > 0) out.set(f[i + 1], f[i].charAt(0));
  return out;
};
