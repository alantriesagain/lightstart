/**
 * @file Secrets for the Pages project: `secretsToPush` reads the names
 * `src/cloudflare`'s `secrets` declares and their values from the project's
 * `.env`, listing any that is missing; `pushSecrets` sends each through
 * wrangler with the value on stdin, and the command prints only the names.
 * A value never reaches an argument or a message.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cloudflareConfigOf } from "./d1.ts";
import { parseEnv, projectNameOf, wranglerEntry } from "./deploy.ts";

/** One secret to put: its name and the value read from `.env`. */
export interface SecretValue {
  name: string;
  value: string;
}

/** What a secrets run will do. */
export interface SecretsPlan {
  project: string;
  secrets: SecretValue[];
  /** The declared names `.env` does not hold. */
  missing: string[];
}

/** What one wrangler run answered. */
export interface SecretRun {
  status: number | null;
  stdout?: string;
  stderr?: string;
}

/** Runs wrangler with the value as its stdin; a fake stands in for tests. */
export type SecretRunner = (args: string[], input: string) => SecretRun;

/** Read `src/cloudflare`'s `secrets` names and the values they have in `.env`. */
export const secretsToPush = async (project: string): Promise<SecretsPlan> => {
  const config = await cloudflareConfigOf(project);
  const declared = config["secrets"];
  if (declared !== undefined && (!Array.isArray(declared) || declared.some((name) => typeof name !== "string" || name.trim() === ""))) {
    throw new Error("src/cloudflare has a secrets that is not a list of names");
  }
  const names = Array.isArray(declared) ? declared.filter((name): name is string => typeof name === "string") : [];
  const filePath = join(project, ".env");
  const file = existsSync(filePath) ? parseEnv(readFileSync(filePath, "utf8")) : {};
  const secrets: SecretValue[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const value = file[name];
    if (value === undefined || value === "") missing.push(name);
    else secrets.push({ name, value });
  }
  return { project: await projectNameOf(project), secrets, missing };
};

/** The wrangler runner a command uses: this package's wrangler, with `env` and the value on stdin. */
export const secretRunner = (env: Record<string, string>): SecretRunner => (args, input) => {
  const sent = spawnSync(process.execPath, [wranglerEntry(), ...args], { env, input, encoding: "utf8" });
  return { status: sent.status, stdout: sent.stdout ?? "", stderr: sent.stderr ?? "" };
};

/** Put every secret through the runner, answering the names put; a failure names it without the value. */
export const pushSecrets = (plan: SecretsPlan, runner: SecretRunner): string[] => {
  const values = plan.secrets.map((secret) => secret.value).filter((value) => value !== "");
  const redact = (text: string): string => values.reduce((out, value) => out.split(value).join("<redacted>"), text);
  const put: string[] = [];
  for (const secret of plan.secrets) {
    const result = runner(["pages", "secret", "put", secret.name, "--project-name", plan.project], secret.value);
    if (result.status !== 0) {
      const detail = redact(`${result.stderr ?? ""}${result.stdout ?? ""}`.trim());
      throw new Error(`wrangler pages secret put ${secret.name} failed${detail === "" ? "" : `: ${detail}`}`);
    }
    put.push(secret.name);
  }
  return put;
};
