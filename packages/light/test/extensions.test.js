/**
 * @file The three command extensions end to end: a project's package under a declared scope
 * extends `light check`, `light test` or `light desktop`, and the command runs its api through the
 * `light` binary exactly as a project would.
 */

import { spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const cliBin = path.resolve(here, "../../cli/bin/light.js");
const cliTypes = pathToFileURL(path.resolve(here, "../../cli/index.ts")).href;

/**
 * A project that declares `@acme` and carries one package's extension of `command`.
 * @param {import("node:test").TestContext} t
 * @param {string} command
 */
const projectWith = (t, command) => {
  const dir = mkdtempSync(path.join(tmpdir(), `light-ext-${command}-`));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: `fixture-${command}`, type: "module", light: { scopes: ["@acme"] } }));
  const lightScope = path.join(dir, "node_modules", "@lightstart");
  mkdirSync(lightScope, { recursive: true });
  symlinkSync(path.resolve(here, ".."), path.join(lightScope, "light"), "dir");
  const pkg = path.join(dir, "node_modules", "@acme", "x");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name: "@acme/x", version: "0.0.0" }));
  const extend = path.join(pkg, "cli", "extend");
  mkdirSync(extend, { recursive: true });
  return { dir, file: path.join(extend, `${command}.js`) };
};

/**
 * @param {string} cwd
 * @param {string[]} args
 * @param {Record<string, string>} [env]
 */
const light = (cwd, args, env = {}) => {
  const result = spawnSync(process.execPath, [cliBin, ...args], { cwd, encoding: "utf8", env: { ...process.env, LIGHT_PROJECT_DIR: cwd, ...env } });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

/**
 * The same through a child that leaves this process's event loop free, for a test that serves
 * the origin itself.
 * @param {string} cwd
 * @param {string[]} args
 * @param {Record<string, string>} [env]
 */
const lightAsync = (cwd, args, env = {}) =>
  new Promise((/** @type {(result: { status: number | null, stdout: string, stderr: string }) => void} */ resolve) => {
    const child = spawn(process.execPath, [cliBin, ...args], { cwd, env: { ...process.env, LIGHT_PROJECT_DIR: cwd, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("exit", (status) => resolve({ status, stdout, stderr }));
  });

const header = `import { defineExtension } from ${JSON.stringify(cliTypes)};\n`;

test("light check loads a rule source an extension adds and a replacement run over --all", (t) => {
  const { dir, file } = projectWith(t, "check");
  const rule = path.join(dir, "node_modules", "@acme", "x", "check", "rules", "demo.js");
  mkdirSync(path.dirname(rule), { recursive: true });
  writeFileSync(rule, `export default { severity: "warn", description: "acme demo", check(ctx) { ctx.report({ file: "package.json", line: 1, col: 1, message: "acme rule ran" }); } };\n`);
  writeFileSync(file, `${header}export default defineExtension("check", {
  args: { all: { flag: true, description: "Check every target with the replacement" } },
  setup(ctx, args, api) {
    api.addSources({ owner: "acme", file: ${JSON.stringify(rule)} });
    api.context((context) => context);
    if (args.all) api.run(async (input) => {
      let passed = true;
      for (const target of input.targets) if (!(await input.runOnce(target))) passed = false;
      if (passed) console.log("acme: checked " + input.targets.length + " target(s)");
      return passed;
    });
  },
});
`);
  const plain = light(dir, ["check", "."]);
  assert.equal(plain.status, 0, plain.stderr);
  assert.match(plain.stdout, /acme rule ran/);
  assert.match(plain.stdout, /\(acme\/demo\)/);
  const replacement = light(dir, ["check", "--all", "."]);
  assert.equal(replacement.status, 0, replacement.stderr);
  assert.match(replacement.stdout, /acme rule ran/);
  assert.match(replacement.stdout, /acme: checked 1 target\(s\)/);
});

test("light test runs extension groups, selects them by flag, and fails when one fails", (t) => {
  const { dir, file } = projectWith(t, "test");
  writeFileSync(file, `${header}export default defineExtension("test", {
  args: { unit: { flag: true, description: "Run the unit group" }, browser: { flag: true, description: "Run the browser group" } },
  setup(ctx, args, api) {
    api.group({ name: "unit", flag: "unit", description: "Unit", run(input) { console.log("group unit " + typeof input.runFiles + " " + typeof input.serve + " " + input.headless); return true; } });
    api.group({ name: "browser", flag: "browser", description: "Browser", run() { console.log("group browser"); return false; } });
  },
});
`);
  const selected = light(dir, ["test", "--unit"]);
  assert.equal(selected.status, 0, selected.stderr);
  assert.match(selected.stdout, /group unit function function true/);
  assert.doesNotMatch(selected.stdout, /group browser/);
  const all = light(dir, ["test"]);
  assert.equal(all.status, 1, all.stderr);
  assert.match(all.stdout, /group unit/);
  assert.match(all.stdout, /group browser/);
});

test("light desktop dev --attach runs a host a desktop extension names on the served origin", async (t) => {
  let requests = 0;
  const server = createServer((_req, res) => {
    requests += 1;
    res.end("ok");
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  const port = address.port;

  const { dir, file } = projectWith(t, "desktop");
  const marker = path.join(dir, "host.json");
  const host = path.join(dir, "host.mjs");
  writeFileSync(host, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const [origin, ...args] = process.argv.slice(2);
writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ origin, args }));
const answer = await fetch(origin);
process.exit(answer.ok ? 0 : 1);
`);
  chmodSync(host, 0o755);
  writeFileSync(file, `${header}export default defineExtension("desktop", {
  setup(ctx, args, api) {
    api.host(() => ${JSON.stringify(host)});
    api.hostArgs((list) => { list.push("--profile"); });
    api.serveArgs((list) => { list.push("--watch"); });
  },
});
`);
  const result = await lightAsync(dir, ["desktop", "dev", "--attach", "--port", String(port)]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(requests > 0);
  const seen = JSON.parse(readFileSync(marker, "utf8"));
  assert.equal(seen.origin, `http://127.0.0.1:${port}`);
  assert.deepEqual(seen.args, ["--profile"]);
});

test("the check entry exports what a replacement run builds on", async () => {
  const check = await import("../check/index.js");
  assert.equal(typeof check.checkTarget, "function");
  assert.equal(typeof check.runRules, "function");
  assert.equal(typeof check.loadRules, "function");
  assert.equal(typeof check.openProject, "function");
  assert.equal(typeof check.formatSummary, "function");
});
