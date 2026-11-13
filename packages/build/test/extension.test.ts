// node-only
/**
 * @file An extension of `light build` from a project's scoped package: its flag shows in
 * `light build --help`, its step prefixes every JavaScript output, and a step reads the mode it set.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, ok } from "@light/test/assert.ts";

const root = fileURLToPath(new URL("./fixtures/extension", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));
const env = { ...process.env, LIGHT_PROJECT_DIR: root };

const main = (): void => {
  const help = spawnSync(process.execPath, [cli, "build", "--help"], { cwd: root, env, encoding: "utf8" });
  ok("build --help exits 0", help.status === 0);
  ok("build --help lists the extension's flag", help.stdout.includes("--banner"));
  if (help.status !== 0) console.log(help.stdout, help.stderr);

  const out = mkdtempSync(join(tmpdir(), "light-build-extension-"));
  try {
    const result = spawnSync(process.execPath, [cli, "build", "--out", out, "--banner", "/* acme banner */", "--ssg"], { cwd: root, env, encoding: "utf8" });
    ok("build exports the extension and exits 0", result.status === 0);
    if (result.status !== 0) console.log(result.stdout, result.stderr);

    const buildDir = join(out, "current");
    const files = readdirSync(buildDir);
    const scripts = files.filter((name) => name.endsWith(".js"));
    ok("the build has a JavaScript output", scripts.length > 0);
    ok("every JavaScript output starts with the banner", scripts.every((name) => readFileSync(join(buildDir, name), "utf8").startsWith("/* acme banner */\n")));
    eq("a step reads the mode the extension set", readFileSync(join(buildDir, "mode.txt"), "utf8"), "ssg");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }

  done();
};

main();
