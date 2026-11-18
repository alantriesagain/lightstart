/**
 * The variables a component's stylesheet lets a theme set, read out of the
 * stylesheet itself, each with what it falls back to when the theme is silent.
 *
 * Pure: the CSS text and the tag in, rows out. A variable that falls back to a
 * shape role (`--radius-field`, `--shadow-box`, ...) sorts first, since those
 * are the ones a skin reaches without naming this component at all.
 */

const ROLE = /^--(radius-(field|selector|box)|shadow-(field|box|focus)|motion-(lift|press)|control-(weight|transform|tracking))$/;

export interface ThemeVariable {
  name: string;
  fallback: string | null;
  role: boolean;
}

export const themeVariables = (css: string, tag: string): ThemeVariable[] => {
  const prefix = `--${tag}-`;
  const found = new Map<string, ThemeVariable>();
  const reads = new RegExp(`var\\(\\s*(${prefix.replace(/-/g, "\\-")}[a-z0-9-]+)\\s*(?:,\\s*([^)]*))?`, "g");
  for (const match of css.matchAll(reads)) {
    const name = match[1];
    const rest = (match[2] ?? "").trim();
    const next = /^var\(\s*(--[a-z0-9-]+)/.exec(rest)?.[1] ?? null;
    const fallback = next ?? (rest ? rest.split(/\s*,\s*/)[0] || null : null);
    const role = Boolean(next && ROLE.test(next));
    const known = found.get(name);
    if (!known || (role && !known.role) || (!known.fallback && fallback))
      found.set(name, { name, fallback, role });
  }
  return [...found.values()].sort((a, b) => Number(b.role) - Number(a.role) || a.name.localeCompare(b.name));
};
