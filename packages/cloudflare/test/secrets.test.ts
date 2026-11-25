// node-only
/**
 * @file Secrets without wrangler: the names read from `src/cloudflare` and
 * their values from a temp `.env`, a missing name reported, and a fake runner
 * receiving each value on stdin but never in its arguments, with the printed
 * names holding no value.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { pushSecrets, secretsToPush } from "../node/secrets.ts";
import type { SecretRunner } from "../node/secrets.ts";

const project = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "light-cloudflare-secrets-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "@me/site", type: "module" }));
  mkdirSync(join(dir, "src"));
  writeFileSync(
    join(dir, "src", "cloudflare.js"),
    'export default { project: "site", secrets: ["JWT_SECRET", "RESEND_API_KEY", "AUTH_FROM_EMAIL"] };\n',
  );
  writeFileSync(join(dir, ".env"), "JWT_SECRET=jwt-value-123\nRESEND_API_KEY=resend-value-456\n");
  return dir;
};

const main = async (): Promise<void> => {
  const dir = project();
  try {
    const plan = await secretsToPush(dir);
    eq("the Pages project is the config's", plan.project, "site");
    eq("the values come from .env", JSON.stringify(plan.secrets), '[{"name":"JWT_SECRET","value":"jwt-value-123"},{"name":"RESEND_API_KEY","value":"resend-value-456"}]');
    eq("a name .env lacks is reported", JSON.stringify(plan.missing), '["AUTH_FROM_EMAIL"]');

    const runs: { args: string[]; input: string }[] = [];
    const runner: SecretRunner = (args, input) => {
      runs.push({ args, input });
      return { status: 0, stdout: "", stderr: "" };
    };
    const put = pushSecrets(plan, runner);
    eq("only the names put are answered", JSON.stringify(put), '["JWT_SECRET","RESEND_API_KEY"]');
    eqn("one wrangler run per secret", runs.length, 2);
    for (const run of runs) {
      ok("the value reaches stdin", run.input === "jwt-value-123" || run.input === "resend-value-456");
      ok("the value never reaches the arguments", !run.args.some((arg) => arg.includes(run.input)));
      ok("the run targets the Pages project", run.args.join(" ").includes("--project-name site"));
    }
    const output = put.map((name) => `Put ${name} on ${plan.project}`).join("\n");
    ok("the output holds no value", !output.includes("jwt-value-123") && !output.includes("resend-value-456"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  done();
};

await main();
