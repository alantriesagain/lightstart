// node-only
/**
 * @file `light verify`: the step order, a skipped step, `--fail-fast`, the exit code and the
 * argument error.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, ok } from "@lightstart/test/assert.ts";

const here = dirname(fileURLToPath(import.meta.url));
const bin = resolve(here, "..", "bin", "light.js");
const cliPackage = resolve(here, "..");

/**
 * A project whose own commands print their name and answer `codes[step]`.
 * @param {Record<string, number>} codes
 */
const projectWith = (codes) => {
  const dir = mkdtempSync(join(tmpdir(), "light-verify-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture-verify", type: "module" }));
  const scope = join(dir, "node_modules", "@lightstart");
  mkdirSync(scope, { recursive: true });
  symlinkSync(cliPackage, join(scope, "cli"), "dir");
  const commands = join(dir, "cli", "commands");
  mkdirSync(commands, { recursive: true });
  for (const [step, code] of Object.entries(codes)) {
    writeFileSync(join(commands, `${step}.js`), `export default { description: "${step}", run() { console.log("ran ${step}"); return ${String(code)}; } };\n`);
  }
  return dir;
};

/**
 * @param {string} dir
 * @param {string[]} [args]
 */
const verify = (dir, args = []) => {
  const result = spawnSync(process.execPath, [bin, "verify", ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, LIGHT_PROJECT_DIR: dir } });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

const all = projectWith({ check: 0, lint: 0, typecheck: 0, test: 0 });
try {
  const result = verify(all);
  eq("every step passes", result.status, 0);
  const order = ["ran check", "ran lint", "ran typecheck", "ran test"].map((line) => result.stdout.indexOf(line));
  ok("the steps run in order", order.every((at, index) => at >= 0 && (index === 0 || at > order[index - 1])));
  ok("the summary names each step", ["check", "lint", "typecheck", "test"].every((step) => result.stdout.includes(`${step.padEnd(10)} pass`)));
  ok("the summary passes", result.stdout.includes("verify: passed"));
} finally {
  rmSync(all, { recursive: true, force: true });
}

const missing = projectWith({ check: 0, lint: 0, test: 0 });
try {
  const result = verify(missing);
  eq("a project without a step still passes", result.status, 0);
  ok("the missing step is skipped", result.stdout.includes("typecheck: skipped (no command)"));
  ok("and does not run", !result.stdout.includes("ran typecheck"));
  ok("the others still run", result.stdout.includes("ran test"));
} finally {
  rmSync(missing, { recursive: true, force: true });
}

const failing = projectWith({ check: 1, lint: 0, typecheck: 0, test: 1 });
try {
  const result = verify(failing);
  eq("a failed step fails verify", result.status, 1);
  ok("the failure is named", result.stdout.includes("check: fail"));
  ok("every step still ran", result.stdout.includes("ran test"));
  ok("the summary fails", result.stdout.includes("verify: failed"));
  const stopped = verify(failing, ["--fail-fast"]);
  eq("--fail-fast fails verify", stopped.status, 1);
  ok("--fail-fast stops after the failure", !stopped.stdout.includes("ran lint"));
} finally {
  rmSync(failing, { recursive: true, force: true });
}

const args = projectWith({ check: 0 });
try {
  const result = verify(args, ["--nope"]);
  eq("an unknown option is an argument error", result.status, 2);
} finally {
  rmSync(args, { recursive: true, force: true });
}

const scripted = mkdtempSync(join(tmpdir(), "light-verify-script-"));
try {
  writeFileSync(join(scripted, "package.json"), JSON.stringify({ name: "fixture-verify-script", type: "module", scripts: { check: "node -e \"console.log('from the script')\"" } }));
  const scope = join(scripted, "node_modules", "@lightstart");
  mkdirSync(scope, { recursive: true });
  symlinkSync(cliPackage, join(scope, "cli"), "dir");
  const result = verify(scripted);
  eq("a project's own script is the step", result.status, 0);
  ok("the script ran", result.stdout.includes("from the script"));
  ok("a step with neither script nor command is skipped", result.stdout.includes("test: skipped (no command)"));
} finally {
  rmSync(scripted, { recursive: true, force: true });
}

done();
