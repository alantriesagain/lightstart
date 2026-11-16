// node-only
/**
 * @file A terminal app's modes: the generation writes the dispatch into
 * `.light/main.ts`, and node runs the fixture's `hello` mode before the host,
 * with its line and its exit code.
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eqn, ok } from "@lightstart/test/assert.ts";
import { generate } from "../node/generate.ts";

const fixture = fileURLToPath(new URL("./fixtures/tui", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-tui-modes-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/dist"),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const main = async (): Promise<void> => {
  const project = copy();
  try {
    const generated = await generate(project);
    ok("the terminal fixture generates", generated !== null);
    if (generated === null) return done();

    const entry = readFileSync(generated.main, "utf8");
    ok("the entry imports the mode by name", entry.includes('import * as mode0 from "../src/modes/hello.ts";'));
    ok("and dispatches it on --hello", entry.includes('argv.includes("--hello")'));

    const run = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", ".light/main.ts", "--hello"], {
      cwd: project,
      encoding: "utf8",
    });
    if ((run.status ?? 1) !== 3) console.log(run.stdout, run.stderr);
    eqn("the mode's exit code is the entry's", run.status ?? 1, 3);
    ok("the mode prints its line", (run.stdout ?? "").includes("mode hello"));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
