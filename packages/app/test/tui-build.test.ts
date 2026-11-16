// node-only
/**
 * @file The terminal fixture's native gates: its `.light/main.ts` compiles
 * fully static under `scriptc coverage`, and `light build` writes its binary.
 */

import { spawnSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eqn, ok } from "@lightstart/test/assert.ts";
import { generate } from "../node/generate.ts";

const fixture = fileURLToPath(new URL("./fixtures/tui", import.meta.url));
const scriptc = fileURLToPath(new URL("../../../node_modules/.bin/scriptc", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));
const bin = fileURLToPath(new URL("../../../node_modules/.bin", import.meta.url));

interface Coverage {
  success: boolean;
  deferred?: unknown[];
  stats?: { percentStatic?: number; statementsFailed?: number };
}

const main = async (): Promise<void> => {
  rmSync(join(fixture, ".light"), { recursive: true, force: true });
  rmSync(join(fixture, "dist"), { recursive: true, force: true });
  try {
    const generated = await generate(fixture);
    ok("the terminal fixture generates", generated !== null && generated.classes !== null);

    const covered = spawnSync(scriptc, ["coverage", ".light/main.ts", "--print=diagnostics"], { cwd: fixture, encoding: "utf8" });
    eqn("scriptc coverage exits 0", covered.status ?? 1, 0);
    const report = JSON.parse(covered.stdout) as Coverage;
    ok("the entry is fully static", report.success && report.stats?.percentStatic === 100 && report.stats.statementsFailed === 0);
    eqn("and defers nothing", report.deferred?.length ?? 0, 0);

    const env = { ...process.env, LIGHT_PROJECT_DIR: fixture, PATH: `${bin}:${process.env["PATH"] ?? ""}`, NO_COLOR: "1" };
    const built = spawnSync(process.execPath, ["--no-warnings", cli, "build"], { cwd: fixture, env, encoding: "utf8" });
    eqn("light build exits 0", built.status ?? 1, 0);
    if ((built.status ?? 1) !== 0) console.log(built.stdout, built.stderr);
    const binary = join(fixture, "dist", "fixture-tui");
    ok("the build writes dist/fixture-tui", existsSync(binary));
    if (existsSync(binary)) ok("the binary is a file", statSync(binary).isFile());
  } finally {
    if (process.env["LIGHT_APP_KEEP"] === undefined) {
      rmSync(join(fixture, ".light"), { recursive: true, force: true });
      rmSync(join(fixture, "dist"), { recursive: true, force: true });
    }
  }
  done();
};

await main();
