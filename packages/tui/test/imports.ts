/**
 * @file What a package reaches: its runtime imports followed from its exports, through its own files and
 * into the packages it names (each resolved through the member's node_modules and the package's
 * export map), so a package's test can say which packages and which files of light it reaches, and
 * that it reaches no app. Type-only imports are left out: they cost nothing at runtime.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const RUNTIME_IMPORT = /^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']/gm;
const SIDE_IMPORT = /^\s*import\s+["']([^"']+)["']/gm;

export class Reach {
  /** The packages reached, by name (`@light/lib`, `@bootstrapp/light`). */
  readonly packages = new Set<string>();
  /** The files reached, absolute and real. */
  readonly files = new Set<string>();

  /** The files of `pkg` reached, relative to its folder. */
  filesOf(pkg: string): string[] {
    const dir = this.dirs.get(pkg);
    if (dir === undefined) return [];
    const out: string[] = [];
    for (const f of this.files) if (f.startsWith(dir + "/")) out.push(f.slice(dir.length + 1));
    return out.sort();
  }

  /** Whether any file of `pkg` under `prefix` (a folder or a file, relative to the package) is reached. */
  reaches(pkg: string, prefix: string): boolean {
    return this.filesOf(pkg).some((f) => f === prefix || f.startsWith(prefix.endsWith("/") ? prefix : prefix + "/"));
  }

  readonly dirs = new Map<string, string>();
}

/** The package.json of the package `spec` names, found through `fromDir`'s node_modules, with its folder. */
const packageDir = (fromDir: string, spec: string): string | null => {
  const parts = spec.split("/");
  const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
};

/** The file a package's export map answers for `sub` ("." or "./x.ts"). */
const exportTarget = (pkgDir: string, sub: string): string | null => {
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as { exports?: Record<string, unknown>; main?: string };
  const exp = pkg.exports;
  if (exp === undefined) return pkg.main !== undefined ? join(pkgDir, pkg.main) : null;
  const pick = (v: unknown): string | null => {
    if (typeof v === "string") return v;
    if (typeof v === "object" && v !== null) {
      const o = v as Record<string, unknown>;
      for (const k of ["import", "default", "types"]) if (typeof o[k] === "string") return o[k] as string;
    }
    return null;
  };
  if (Object.hasOwn(exp, sub)) {
    const t = pick(exp[sub]);
    return t === null ? null : join(pkgDir, t);
  }
  for (const [key, value] of Object.entries(exp)) {
    if (!key.includes("*")) continue;
    const [before, after] = key.split("*");
    if (!sub.startsWith(before) || !sub.endsWith(after)) continue;
    const t = pick(value);
    if (t === null) continue;
    return join(pkgDir, t.replace("*", sub.slice(before.length, sub.length - after.length)));
  }
  return null;
};

/** `spec` resolved from `file`: a relative file (`.ts` first, then as written), or a package's export. */
const resolveSpec = (file: string, spec: string, reach: Reach): string | null => {
  if (spec.startsWith("node:")) return null;
  if (spec.startsWith(".")) {
    const base = resolve(dirname(file), spec);
    for (const p of [base, base.replace(/\.js$/, ".ts"), base + ".ts", base + ".js", join(base, "index.ts")]) if (existsSync(p) && !p.endsWith("/")) return realpathSync(p);
    return null;
  }
  const dir = packageDir(dirname(file), spec);
  if (dir === null) return null;
  const parts = spec.split("/");
  const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  reach.packages.add(name);
  reach.dirs.set(name, dir);
  const sub = spec.length > name.length ? "." + spec.slice(name.length) : ".";
  const target = exportTarget(dir, sub);
  if (target === null) return null;
  const real = target.endsWith(".js") && !existsSync(target) && existsSync(target.replace(/\.js$/, ".ts")) ? target.replace(/\.js$/, ".ts") : target;
  return existsSync(real) ? realpathSync(real) : null;
};

/** The reach of `pkgDir`'s exports (every explicit export target, and index.ts). */
export const reachOf = (pkgDir: string): Reach => {
  const reach = new Reach();
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as { name: string; exports?: Record<string, unknown> };
  reach.dirs.set(pkg.name, realpathSync(pkgDir));
  const starts: string[] = [];
  for (const [key, value] of Object.entries(pkg.exports ?? {})) if (!key.includes("*") && typeof value === "string") starts.push(join(pkgDir, value));
  const queue = starts.map((p) => realpathSync(p));
  while (queue.length > 0) {
    const file = queue.pop() ?? "";
    if (reach.files.has(file)) continue;
    reach.files.add(file);
    const text = readFileSync(file, "utf8");
    const specs: string[] = [];
    for (const m of text.matchAll(RUNTIME_IMPORT)) specs.push(m[1]);
    for (const m of text.matchAll(SIDE_IMPORT)) specs.push(m[1]);
    for (const spec of specs) {
      const next = resolveSpec(file, spec, reach);
      if (next !== null && !reach.files.has(next)) queue.push(next);
    }
  }
  return reach;
};

/** The packages `reach` names, sorted, as one line for a check. */
export const packagesLine = (reach: Reach, own: string): string => Array.from(reach.packages).filter((p) => p !== own).sort().join(", ");
