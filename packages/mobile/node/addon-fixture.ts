/**
 * @file A temp app for an add-on's tests: a copy of the package's fixture app
 * whose `node_modules/@lightstart` links each `@lightstart` dependency the
 * fixture declares, resolved from the calling package (so the package declares
 * them, as dev dependencies), and the `light` CLI it runs, resolved the same
 * way. Nothing assumes the package sits beside light's own packages, so an
 * add-on's tests run in any workspace.
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** One run of the `light` CLI in the temp app. */
export interface FixtureRun {
  status: number;
  output: string;
}

/** The temp app: its folder, a CLI run in it, and its removal. */
export interface AddonFixture {
  project: string;
  run(args: readonly string[], options?: { timeout?: number }): FixtureRun;
  remove(): void;
}

const SECTIONS = ["dependencies", "devDependencies"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The `@lightstart` packages the fixture's `package.json` declares. */
const declaredOf = (fixture: string): string[] => {
  const parsed: unknown = JSON.parse(readFileSync(join(fixture, "package.json"), "utf8"));
  if (!isRecord(parsed)) return [];
  const names = new Set<string>();
  for (const section of SECTIONS) {
    const deps = parsed[section];
    if (!isRecord(deps)) continue;
    for (const name of Object.keys(deps)) if (name.startsWith("@lightstart/")) names.add(name);
  }
  return [...names].sort();
};

/**
 * Copy `fixture` (a folder URL or path) to a temp folder named after `prefix`,
 * link the `@lightstart` packages it declares as resolved from `from` (the
 * test's `import.meta.url`), and answer the app with a `run` of the CLI.
 * A declared package `from` cannot resolve is an error naming it.
 */
export const addonFixture = (fixture: string | URL, from: string, prefix: string): AddonFixture => {
  const source = fixture instanceof URL ? fileURLToPath(fixture) : fixture;
  const require = createRequire(from);
  const resolveDir = (name: string): string => {
    try {
      return dirname(require.resolve(`${name}/package.json`));
    } catch {
      throw new Error(`The fixture declares ${name}, which ${fileURLToPath(from)} cannot resolve: add it to the package's devDependencies`);
    }
  };
  const cli = join(resolveDir("@lightstart/cli"), "bin", "light.js");
  const project = mkdtempSync(join(tmpdir(), `${prefix}-`));
  cpSync(source, project, {
    recursive: true,
    filter: (path) => path === source || (!path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed")),
  });
  const scope = join(project, "node_modules", "@lightstart");
  mkdirSync(scope, { recursive: true });
  for (const name of declaredOf(source)) symlinkSync(resolveDir(name), join(scope, name.slice("@lightstart/".length)), "dir");
  return {
    project,
    run(args, options = {}) {
      const result = spawnSync(process.execPath, ["--no-warnings", cli, ...args], {
        cwd: project,
        env: { ...process.env, LIGHT_PROJECT_DIR: project, NO_COLOR: "1" },
        encoding: "utf8",
        timeout: options.timeout ?? 600_000,
        maxBuffer: 32 * 1024 * 1024,
      });
      return { status: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
    },
    remove() {
      rmSync(project, { recursive: true, force: true });
    },
  };
};
