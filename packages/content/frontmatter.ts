/**
 * @file A Markdown file split into its frontmatter and its body, and the YAML subset the
 * frontmatter is written in: `key: value` scalars (a bare or quoted string, a number,
 * `true`/`false`, `null`), inline lists `[a, b]`, block lists of scalars, block lists of
 * flat maps and `|` literal strings. A line the subset cannot read is an error naming it.
 */

/** A file's frontmatter and the Markdown body after it. */
export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

const scalar = (raw: string): unknown => {
  const text = raw.trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      return JSON.parse(text);
    } catch {
      return text.slice(1, -1);
    }
  }
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replace(/''/g, "'");
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null" || text === "~") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return text;
};

const splitList = (text: string): string[] => {
  const items: string[] = [];
  let buffer = "";
  let quote: string | null = null;
  for (let index = 0; index < text.length; index++) {
    const char = text.charAt(index);
    if (quote !== null) {
      buffer += char;
      if (char === quote && text.charAt(index - 1) !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }
    if (char === ",") {
      items.push(buffer);
      buffer = "";
      continue;
    }
    buffer += char;
  }
  items.push(buffer);
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
};

const valueOf = (raw: string): unknown => {
  const text = raw.trim();
  if (text.startsWith("[") && text.endsWith("]")) return splitList(text.slice(1, -1)).map(scalar);
  return scalar(text);
};

const KEY = /^([A-Za-z0-9_][A-Za-z0-9_.-]*):(?:\s*(.*))?$/;
const LIST_ITEM = /^(\s*)-\s+(.*)$/;

const indentation = (line: string): number => line.length - line.trimStart().length;
const blank = (line: string): boolean => line.trim().length === 0;

const errorAt = (line: number, text: string): Error => new Error(`Frontmatter line ${String(line)} cannot be read: ${text}`);

/**
 * Parse the lines between two `---` fences. `offset` is the file line of `lines[0]`, so an
 * error names the line in the file.
 */
const parseYaml = (lines: string[], offset: number): Record<string, unknown> => {
  const data: Record<string, unknown> = {};
  let at = 0;
  while (at < lines.length) {
    const line = lines[at];
    if (blank(line)) {
      at++;
      continue;
    }
    const match = KEY.exec(line);
    if (match === null) throw errorAt(offset + at + 1, line);
    const key = match[1];
    const rest = (match[2] ?? "").trim();

    if (rest === "|") {
      at++;
      const collected: string[] = [];
      let indent = -1;
      while (at < lines.length && (blank(lines[at]) || indentation(lines[at]) > 0)) {
        const text = lines[at];
        if (!blank(text) && indent < 0) indent = indentation(text);
        collected.push(blank(text) ? "" : text.slice(Math.max(indent, 0)));
        at++;
      }
      data[key] = collected.join("\n").replace(/\n+$/, "");
      continue;
    }

    if (rest.length > 0) {
      data[key] = valueOf(rest);
      at++;
      continue;
    }

    const next = lines[at + 1];
    if (next !== undefined && LIST_ITEM.test(next)) {
      const dashIndent = indentation(next);
      const list: unknown[] = [];
      at++;
      while (at < lines.length) {
        const itemLine = lines[at];
        if (blank(itemLine)) {
          at++;
          continue;
        }
        const item = LIST_ITEM.exec(itemLine);
        if (item === null || indentation(itemLine) !== dashIndent) break;
        const text = item[2].trim();
        const mapKey = KEY.exec(text);
        if (mapKey === null) {
          list.push(valueOf(text));
          at++;
          continue;
        }
        const map: Record<string, unknown> = {};
        const firstKey = mapKey[1];
        const firstRest = (mapKey[2] ?? "").trim();
        map[firstKey] = firstRest.length === 0 ? null : valueOf(firstRest);
        at++;
        while (at < lines.length) {
          const continuation = lines[at];
          if (blank(continuation)) {
            at++;
            continue;
          }
          if (indentation(continuation) <= dashIndent) break;
          const entry = KEY.exec(continuation.trim());
          if (entry === null) throw errorAt(offset + at + 1, continuation);
          const entryRest = (entry[2] ?? "").trim();
          map[entry[1]] = entryRest.length === 0 ? null : valueOf(entryRest);
          at++;
        }
        list.push(map);
      }
      data[key] = list;
      continue;
    }

    data[key] = null;
    at++;
  }
  return data;
};

/**
 * Split a Markdown file at its `---` fences and parse the frontmatter; a file with no
 * frontmatter has an empty `data` and the whole text as its body.
 */
export const parseFrontmatter = (text: string): Frontmatter => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length === 0 || lines[0].trim() !== "---") return { data: {}, body: text };
  let end = -1;
  for (let index = 1; index < lines.length; index++) {
    if (lines[index].trim() === "---") {
      end = index;
      break;
    }
  }
  if (end < 0) throw errorAt(1, "the opening --- has no closing ---");
  const data = parseYaml(lines.slice(1, end), 1);
  return { data, body: lines.slice(end + 1).join("\n") };
};
