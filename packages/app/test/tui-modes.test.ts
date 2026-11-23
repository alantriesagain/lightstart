// node-only
/**
 * @file A terminal app's modes: the generation writes the dispatch into
 * `.light/main.ts`, and node runs the fixture's `hello` mode before the host,
 * with its line and its exit code; a mode opens the app's stores through its
 * context, and what it writes lands in the stores under --data.
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
    ok("the entry imports the mode by name", entry.includes('import * as mode1 from "../src/modes/hello.ts";'));
    ok("and dispatches it on --hello", entry.includes('argv.includes("--hello")'));

    const run = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", ".light/main.ts", "--hello"], {
      cwd: project,
      encoding: "utf8",
    });
    if ((run.status ?? 1) !== 3) console.log(run.stdout, run.stderr);
    eqn("the mode's exit code is the entry's", run.status ?? 1, 3);
    ok("the mode prints its line", (run.stdout ?? "").includes("mode hello"));

    ok("a mode is handed a context over the argv without its own flag", entry.includes('new ModeContext(manifest, argv.filter((given) => given !== "--count"))'));
    const data = join(project, "mode-data");
    const count = (): string => {
      const counted = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", ".light/main.ts", "--count", "--data", data], { cwd: project, encoding: "utf8" });
      if ((counted.status ?? 1) !== 0) console.log(counted.stdout, counted.stderr);
      return (counted.stdout ?? "").trim();
    };
    const notesOf = (line: string): number => Number(/notes (\d+)$/.exec(line)?.[1] ?? "-1");
    const first = notesOf(count());
    ok("a mode opens the app's stores (seeded once) and writes through its model", first >= 1);
    eqn("into the stores under --data, which a second run reads with its note", notesOf(count()), first + 1);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
