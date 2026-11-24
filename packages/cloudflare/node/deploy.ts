/**
 * @file The deploy, apart from the command: the project's Pages project name
 * (`src/cloudflare` or the package's name), the credentials (the environment
 * first, then the project's `.env`), the build to upload (`.deployed/current`
 * or a named build), and the wrangler invocations that create the project and
 * upload the build. `planDeploy` only reads; `runDeploy` runs the plan.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** What one deploy will do. */
export interface DeployPlan {
  /** The Pages project. */
  project: string;
  /** The build folder uploaded, resolved. */
  buildDir: string;
  /** The branch the upload goes to: `main` for production, `preview` otherwise. */
  branch: string;
  /** Whether it is the production deploy. */
  production: boolean;
  /** The environment wrangler runs with, the credentials under wrangler's names. */
  env: Record<string, string>;
}

/** What a deploy is asked for. */
export interface DeployOptions {
  /** A build id under `.deployed/builds`; `.deployed/current` when absent. */
  build?: string;
  /** Deploy to the production branch. */
  production?: boolean;
  /** The environment to read credentials from; `process.env` when absent. */
  environment?: Record<string, string | undefined>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** `KEY=VALUE` lines of a `.env` file, quotes stripped, comments and blanks skipped. */
export const parseEnv = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at <= 0) continue;
    const key = line.slice(0, at).replace(/^export\s+/, "").trim();
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
};

const sourceOf = (project: string): string | null => {
  const ts = join(project, "src", "cloudflare.ts");
  const js = join(project, "src", "cloudflare.js");
  if (existsSync(ts) && existsSync(js)) throw new Error("The app has both src/cloudflare.ts and src/cloudflare.js; keep one of them");
  if (existsSync(ts)) return ts;
  if (existsSync(js)) return js;
  return null;
};

/** The Pages project: `src/cloudflare`'s `project`, else the package's name. */
export const projectNameOf = async (project: string): Promise<string> => {
  const source = sourceOf(project);
  if (source !== null) {
    const loaded: unknown = (await import(`${pathToFileURL(source).href}?mtime=${String(Date.now())}`) as { default?: unknown }).default;
    if (!isRecord(loaded)) throw new Error(`${source} default-exports no config; use defineCloudflare({ project })`);
    const name = loaded["project"];
    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) throw new Error(`${source} has a project that is not a name`);
    if (typeof name === "string") return name;
  }
  const pkg: unknown = JSON.parse(readFileSync(join(project, "package.json"), "utf8"));
  const name = isRecord(pkg) ? pkg["name"] : undefined;
  if (typeof name !== "string" || name === "") throw new Error("No Pages project: name one in src/cloudflare.js (defineCloudflare({ project })) or give package.json a name");
  return name.replace(/^@[^/]+\//, "");
};

/** The build folder: `.deployed/builds/<build>`, or what `.deployed/current` points at. */
export const buildDirOf = (project: string, build?: string): string => {
  const dir = build === undefined ? join(project, ".deployed", "current") : join(project, ".deployed", "builds", build);
  if (!existsSync(join(dir, "index.html"))) throw new Error(build === undefined ? "No build to deploy: run `light build` first" : `No build ${build} under .deployed/builds`);
  return realpathSync(dir);
};

/** Read what a deploy needs, failing with what is missing; touches nothing. */
export const planDeploy = async (project: string, options: DeployOptions = {}): Promise<DeployPlan> => {
  const environment = options.environment ?? process.env;
  const file = join(project, ".env");
  const fromFile = existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
  const read = (key: string): string | undefined => environment[key] ?? fromFile[key];
  const accountId = read("CF_ACCOUNT_ID");
  const apiToken = read("CF_API_TOKEN");
  const missing = [accountId === undefined || accountId === "" ? "CF_ACCOUNT_ID" : "", apiToken === undefined || apiToken === "" ? "CF_API_TOKEN" : ""].filter((key) => key !== "");
  if (missing.length > 0) throw new Error(`Missing ${missing.join(" and ")}: set them in the environment or in the project's .env (and keep .env out of git)`);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  env["CLOUDFLARE_ACCOUNT_ID"] = accountId ?? "";
  env["CLOUDFLARE_API_TOKEN"] = apiToken ?? "";
  const production = options.production === true;
  return { project: await projectNameOf(project), buildDir: buildDirOf(project, options.build), branch: production ? "main" : "preview", production, env };
};

/** The wrangler arguments that create the Pages project and upload the build. */
export const wranglerSteps = (plan: DeployPlan): string[][] => [
  ["pages", "project", "create", plan.project, "--production-branch", "main"],
  ["pages", "deploy", plan.buildDir, "--project-name", plan.project, "--branch", plan.branch, "--commit-dirty=true"],
];

/** The wrangler this package pins: its JavaScript entry, run with node. */
export const wranglerEntry = (): string => {
  const require = createRequire(import.meta.url);
  return join(require.resolve("wrangler/package.json"), "..", "bin", "wrangler.js");
};

/** Run a plan: create the project (an existing one is fine), then upload; answers wrangler's exit code. */
export const runDeploy = (plan: DeployPlan, cwd: string, log: (line: string) => void): number => {
  const [create, upload] = wranglerSteps(plan);
  const entry = wranglerEntry();
  const made = spawnSync(process.execPath, [entry, ...(create ?? [])], { cwd, env: plan.env, encoding: "utf8" });
  const said = `${made.stdout ?? ""}${made.stderr ?? ""}`;
  if (made.status === 0) log(`Created the Pages project ${plan.project}`);
  else if (!/already exists/i.test(said)) {
    log(said.trim());
    return made.status ?? 1;
  }
  const sent = spawnSync(process.execPath, [entry, ...(upload ?? [])], { cwd, env: plan.env, stdio: "inherit" });
  return sent.status ?? 1;
};
