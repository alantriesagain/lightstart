// node-only
/**
 * @file The deploy plan without the network: the `.env` reader, the Pages
 * project from `src/cloudflare` or the package's name, the build folder, the
 * credentials (the environment over `.env`, a clear error when missing), the
 * branch, and the wrangler steps; and the pinned wrangler resolves.
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { buildDirOf, parseEnv, planDeploy, projectNameOf, wranglerEntry, wranglerSteps } from "../node/deploy.ts";

const rejection = async (work: () => Promise<unknown>): Promise<string> => {
  try {
    await work();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const project = (name: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "light-cloudflare-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, type: "module" }));
  return dir;
};

const withBuild = (dir: string, id: string): void => {
  mkdirSync(join(dir, ".deployed", "builds", id), { recursive: true });
  writeFileSync(join(dir, ".deployed", "builds", id, "index.html"), "<!doctype html>");
  symlinkSync(join("builds", id), join(dir, ".deployed", "current"));
};

const main = async (): Promise<void> => {
  eq("a .env is read, quotes stripped, comments and blanks skipped", JSON.stringify(parseEnv('# creds\nCF_ACCOUNT_ID=abc\n\nexport CF_API_TOKEN="t0k"\nBROKEN\n')), '{"CF_ACCOUNT_ID":"abc","CF_API_TOKEN":"t0k"}');

  const site = project("@me/site");
  const named = project("plain");
  try {
    eq("the project is the package's name, its scope left out", await projectNameOf(site), "site");
    mkdirSync(join(named, "src"));
    writeFileSync(join(named, "src", "cloudflare.js"), 'export default { project: "chosen" };\n');
    eq("src/cloudflare names the project", await projectNameOf(named), "chosen");

    ok("no build is an error saying to build", (await rejection(() => planDeploy(site, { environment: { CF_ACCOUNT_ID: "a", CF_API_TOKEN: "t" } }))).includes("light build"));
    withBuild(site, "20261124-120000");
    ok("the current build is what .deployed/current points at", buildDirOf(site).endsWith(join("builds", "20261124-120000")));
    ok("an unknown build id is an error naming it", (await rejection(async () => buildDirOf(site, "nope"))).includes("nope"));

    const missing = await rejection(() => planDeploy(site, { environment: {} }));
    ok("missing credentials name both keys and .env", missing.includes("CF_ACCOUNT_ID") && missing.includes("CF_API_TOKEN") && missing.includes(".env"));

    writeFileSync(join(site, ".env"), "CF_ACCOUNT_ID=from-file\nCF_API_TOKEN=file-token\n");
    const preview = await planDeploy(site, { environment: { CF_API_TOKEN: "env-token" } });
    eq("the environment wins over .env, .env fills the rest", `${preview.env["CLOUDFLARE_ACCOUNT_ID"] ?? ""} ${preview.env["CLOUDFLARE_API_TOKEN"] ?? ""}`, "from-file env-token");
    eq("a deploy is a preview by default", `${preview.branch} ${String(preview.production)}`, "preview false");
    const production = await planDeploy(site, { environment: {}, production: true });
    eq("--production deploys main", production.branch, "main");
    const [create, upload] = wranglerSteps(production);
    eq("the first step creates the project on main", (create ?? []).join(" "), "pages project create site --production-branch main");
    eq("the second uploads the build to the branch", (upload ?? []).join(" "), `pages deploy ${production.buildDir} --project-name site --branch main --commit-dirty=true`);
  } finally {
    rmSync(site, { recursive: true, force: true });
    rmSync(named, { recursive: true, force: true });
  }

  ok("the pinned wrangler resolves", existsSync(wranglerEntry()));
  done();
};

await main();
