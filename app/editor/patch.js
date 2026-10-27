/**
 * Unified diffs: parse what `git diff` writes (multi-file, renames, binary,
 * missing trailing newlines), format one from two texts, apply one with a
 * line offset tolerance.
 */

/** @import { PatchFile, PatchHunk, PatchLine, FormatPatchOptions, ApplyPatchOptions, ApplyPatchResult } from "./types.js" */
import { diffLines } from "./diff.js";

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;
const NO_NEWLINE = "\\ No newline at end of file";

/**
 * @param {string} path
 * @returns {string}
 */
const stripPrefix = (path) => (path === "/dev/null" ? path : path.replace(/^[ab]\//, ""));

/**
 * @param {string} line
 * @param {string} prefix
 * @returns {string | null}
 */
const after = (line, prefix) => (line.startsWith(prefix) ? line.slice(prefix.length) : null);

/**
 * @returns {PatchFile}
 */
const emptyFile = () => ({ oldPath: "", newPath: "", status: "modified", binary: false, hunks: [] });

/**
 * @param {string} text
 * @returns {PatchFile[]}
 */
export const parsePatch = (text) => {
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  /** @type {PatchFile[]} */
  const files = [];
  /** @type {PatchFile | null} */
  let file = null;
  let i = 0;
  const start = () => {
    file = emptyFile();
    files.push(file);
    return file;
  };
  while (i < lines.length) {
    const line = lines[i];
    const git = /^diff --git a\/(.*) b\/(.*)$/.exec(line);
    if (git) {
      file = start();
      file.oldPath = git[1];
      file.newPath = git[2];
      i++;
      continue;
    }
    if (!file || file.hunks.length) {
      const old = after(line, "--- ");
      if (old !== null && lines[i + 1]?.startsWith("+++ ")) file = start();
    }
    if (!file) {
      i++;
      continue;
    }
    const oldHeader = after(line, "--- ");
    if (oldHeader !== null && !file.hunks.length) {
      const path = stripPrefix(oldHeader.split("\t")[0]);
      if (path === "/dev/null") file.status = "added";
      else file.oldPath = path;
      i++;
      continue;
    }
    const newHeader = after(line, "+++ ");
    if (newHeader !== null && !file.hunks.length) {
      const path = stripPrefix(newHeader.split("\t")[0]);
      if (path === "/dev/null") file.status = "deleted";
      else file.newPath = path;
      i++;
      continue;
    }
    if (after(line, "rename from ") !== null) {
      file.status = "renamed";
      file.oldPath = /** @type {string} */ (after(line, "rename from "));
      i++;
      continue;
    }
    if (after(line, "rename to ") !== null) {
      file.newPath = /** @type {string} */ (after(line, "rename to "));
      i++;
      continue;
    }
    if (line.startsWith("Binary files ") || line === "GIT binary patch") {
      file.binary = true;
      i++;
      continue;
    }
    if (line.startsWith("new file mode")) file.status = "added";
    if (line.startsWith("deleted file mode")) file.status = "deleted";
    const header = HUNK_HEADER.exec(line);
    if (header) {
      /** @type {PatchHunk} */
      const hunk = {
        oldStart: Number(header[1]),
        oldLines: header[2] === undefined ? 1 : Number(header[2]),
        newStart: Number(header[3]),
        newLines: header[4] === undefined ? 1 : Number(header[4]),
        header: header[5],
        lines: [],
      };
      file.hunks.push(hunk);
      i++;
      let oldLeft = hunk.oldLines;
      let newLeft = hunk.newLines;
      while (i < lines.length && (oldLeft > 0 || newLeft > 0)) {
        const l = lines[i];
        if (l === NO_NEWLINE) {
          const last = hunk.lines[hunk.lines.length - 1];
          if (last) last.noNewline = true;
          i++;
          continue;
        }
        const type = /** @type {PatchLine["type"]} */ (l[0] === "+" || l[0] === "-" ? l[0] : " ");
        const body = l.length ? l.slice(1) : "";
        hunk.lines.push({ type, text: body });
        if (type !== "+") oldLeft--;
        if (type !== "-") newLeft--;
        i++;
      }
      if (i < lines.length && lines[i] === NO_NEWLINE) {
        const last = hunk.lines[hunk.lines.length - 1];
        if (last) last.noNewline = true;
        i++;
      }
      continue;
    }
    i++;
  }
  for (const f of files) {
    if (!f.oldPath && f.newPath) f.oldPath = f.newPath;
    if (!f.newPath && f.oldPath) f.newPath = f.oldPath;
  }
  return files;
};

/**
 * @param {string} text
 * @returns {{ lines: string[], trailingNewline: boolean }}
 */
const splitLines = (text) => {
  const lines = text.split("\n");
  const trailingNewline = text.endsWith("\n");
  if (trailingNewline) lines.pop();
  if (text === "") return { lines: [], trailingNewline: false };
  return { lines, trailingNewline };
};

/**
 * @param {number} start
 * @param {number} count
 * @returns {string}
 */
const range = (start, count) => (count === 1 ? String(start) : `${start},${count}`);

/**
 * @param {string} original
 * @param {string} modified
 * @param {FormatPatchOptions} [options]
 * @returns {string} empty when the texts are equal
 */
export const formatPatch = (original, modified, { oldPath = "a", newPath = "b", context = 3 } = {}) => {
  if (original === modified) return "";
  const a = splitLines(original);
  const b = splitLines(modified);
  const keyed = (/** @type {{ lines: string[], trailingNewline: boolean }} */ side) =>
    side.lines.map((l, i) => (i === side.lines.length - 1 && !side.trailingNewline ? `${l}\0` : l));
  const hunks = diffLines(keyed(a), keyed(b));
  const edits = hunks.filter((h) => h.type !== "equal");
  const groups = [];
  for (const h of edits) {
    const last = groups[groups.length - 1];
    if (last && h.aFrom - last[last.length - 1].aTo <= context * 2) last.push(h);
    else groups.push([h]);
  }
  const out = [`--- ${oldPath}`, `+++ ${newPath}`];
  for (const group of groups) {
    const aFrom = Math.max(0, group[0].aFrom - context);
    const aTo = Math.min(a.lines.length, group[group.length - 1].aTo + context);
    const bFrom = Math.max(0, group[0].bFrom - context);
    const bTo = Math.min(b.lines.length, group[group.length - 1].bTo + context);
    /** @type {Array<[string, string, boolean]>} */
    const body = [];
    let x = aFrom;
    let y = bFrom;
    for (const h of group) {
      while (x < h.aFrom) {
        body.push([" ", a.lines[x], x === a.lines.length - 1 && !a.trailingNewline]);
        x++;
        y++;
      }
      for (; x < h.aTo; x++) body.push(["-", a.lines[x], x === a.lines.length - 1 && !a.trailingNewline]);
      for (; y < h.bTo; y++) body.push(["+", b.lines[y], y === b.lines.length - 1 && !b.trailingNewline]);
    }
    while (x < aTo) {
      body.push([" ", a.lines[x], x === a.lines.length - 1 && !a.trailingNewline]);
      x++;
      y++;
    }
    out.push(`@@ -${range(aFrom + (aTo > aFrom ? 1 : 0), aTo - aFrom)} +${range(bFrom + (bTo > bFrom ? 1 : 0), bTo - bFrom)} @@`);
    for (const [type, text, noNewline] of body) {
      out.push(type + text);
      if (noNewline) out.push(NO_NEWLINE);
    }
  }
  return `${out.join("\n")}\n`;
};

/**
 * @param {string[]} lines
 * @param {PatchHunk} hunk
 * @param {number} at 0-based
 * @returns {boolean}
 */
const matchesAt = (lines, hunk, at) => {
  let i = at;
  for (const l of hunk.lines) {
    if (l.type === "+") continue;
    if (lines[i] !== l.text) return false;
    i++;
  }
  return true;
};

/**
 * @param {string} text
 * @param {PatchFile} file
 * @param {ApplyPatchOptions} [options]
 * @returns {ApplyPatchResult}
 */
export const applyPatch = (text, file, { fuzz = 0 } = {}) => {
  const { lines, trailingNewline } = splitLines(text);
  /** @type {number[]} */
  const rejected = [];
  let delta = 0;
  let endsWithNewline = trailingNewline;
  file.hunks.forEach((hunk, index) => {
    const expected = Math.max(0, hunk.oldStart - 1 + delta);
    const oldCount = hunk.lines.filter((l) => l.type !== "+").length;
    let at = -1;
    for (let offset = 0; offset <= fuzz && at === -1; offset++)
      for (const candidate of offset ? [expected - offset, expected + offset] : [expected])
        if (candidate >= 0 && candidate + oldCount <= lines.length && matchesAt(lines, hunk, candidate)) {
          at = candidate;
          break;
        }
    if (at === -1) {
      rejected.push(index);
      return;
    }
    const replacement = hunk.lines.filter((l) => l.type !== "-").map((l) => l.text);
    lines.splice(at, oldCount, ...replacement);
    delta += replacement.length - oldCount + (at - expected);
    const lastNew = [...hunk.lines].reverse().find((l) => l.type !== "-");
    if (lastNew && at + replacement.length === lines.length) endsWithNewline = !lastNew.noNewline;
  });
  return { text: lines.join("\n") + (endsWithNewline && lines.length ? "\n" : ""), rejected };
};
