// node-only
/**
 * @file Secrets without wrangler: the names read from `src/cloudflare` and
 * their values from a temp `.env`, a missing name reported, and a fake runner
 * receiving each value on stdin but never in its arguments, with the printed
 * names holding no value; the preview environment gets the same secrets in
 * one API call, and a failed call carries no value.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { cloudflareApi } from "../node/cloudflare-api.ts";
import { pushPreviewSecrets, pushSecrets, secretsToPush } from "../node/secrets.ts";
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

    const sent: { method: string; url: string; body: string }[] = [];
    const api = (status: number, body: unknown) =>
      cloudflareApi({
        accountId: "acc",
        apiToken: "tok",
        fetch: async (url, init) => {
          sent.push({ method: String(init?.method), url: String(url), body: String(init?.body) });
          return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
        },
      });
    const previewed = await pushPreviewSecrets(plan, api(200, { success: true, result: {} }));
    eq("the preview answers the names", JSON.stringify(previewed), '["JWT_SECRET","RESEND_API_KEY"]');
    eqn("one API call for the preview", sent.length, 1);
    eq("it PATCHes the Pages project", `${sent[0]?.method} ${sent[0]?.url}`, "PATCH https://api.cloudflare.com/client/v4/accounts/acc/pages/projects/site");
    eq(
      "the body sets the preview's secrets only",
      sent[0]?.body ?? "",
      JSON.stringify({ deployment_configs: { preview: { env_vars: { JWT_SECRET: { type: "secret_text", value: "jwt-value-123" }, RESEND_API_KEY: { type: "secret_text", value: "resend-value-456" } } } } }),
    );
    let failed = "";
    try {
      await pushPreviewSecrets(plan, api(400, { success: false, errors: [{ code: 8000000, message: "bad value jwt-value-123" }] }));
    } catch (error) {
      failed = error instanceof Error ? error.message : String(error);
    }
    ok("a failed preview call is an error", failed.includes("preview environment failed"));
    ok("the error carries no value", !failed.includes("jwt-value-123") && failed.includes("<redacted>"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  done();
};

await main();
