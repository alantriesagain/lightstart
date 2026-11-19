// node-only
/**
 * @file The generation for a terminal app: `.light/app.ts` carries the root
 * view's class, `.light/main.ts` starts the terminal host with the baked
 * tables, and `.light/classes.baked.ts` holds the classes the views write.
 */

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { generate } from "../node/generate.ts";

const fixture = fileURLToPath(new URL("./fixtures/tui", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-tui-generate-"));
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
    const first = await generate(project);
    ok("the fixture has an app", first !== null);
    if (first === null) return done();

    eq("the host is the terminal", first.host, "tui");
    ok("the root view and row view are found", first.views.join(",") === "app-root,note-row");
    ok("the modes are found", first.modes.join(",") === "hello");
    ok("the first run wrote", first.changed);

    const manifest = readFileSync(first.manifest, "utf8");
    ok("the root view is the default import", manifest.includes('import rootView from "../src/views/app-root.ts";'));
    ok("the manifest carries it", manifest.includes("  rootView,"));
    ok("the other view is side-effect only", manifest.includes('import "../src/views/note-row.ts";'));

    eq("the entry runs the modes before the host", readFileSync(first.main, "utf8"), 'import { start } from "@lightstart/app/tui";\nimport manifest from "./app.ts";\nimport { dark, light } from "./classes.baked.ts";\nimport * as mode0 from "../src/modes/hello.ts";\n\nconst argv = process.argv.slice(2);\n\nconst matches0 = Reflect.get(mode0, "matches");\n\nif (typeof matches0 === "function" ? (matches0 as (given: readonly string[]) => boolean)(argv) : argv.includes("--hello")) {\n  process.exit(await mode0.main(argv));\n}\n\nawait start(manifest, { classes: { dark, light } });\n');

    ok("the baked table is written", first.classes !== null);
    if (first.classes !== null) {
      const table = readFileSync(first.classes, "utf8");
      ok("it has the dark scheme", table.includes("export const dark: BakedEntry[] = ["));
      ok("it has the light scheme", table.includes("export const light: BakedEntry[] = ["));
      ok("it carries a class the root view writes", table.includes('["flex-1 border", [["flex", 1, 0], ["border", true, 0]]]'));
      ok("it carries the row's conditional class", table.includes('["text-muted focus:font-bold", [["fg", "#7f857e", 0], ["bold", true, 1]]]'));
    }

    const rows = join(first.dir, "models.ts");
    ok("the models file is written", existsSync(rows));
    if (existsSync(rows)) {
      const models = readFileSync(rows, "utf8");
      ok("it says it is generated", models.startsWith("/**\n * @file The row classes of the app's models"));
      ok("a number id is typed and checked", models.includes("export class ItemRow {\n  id: number;") && models.includes('if (typeof id !== "number") return null;'));
      ok("a required string is non-null", models.includes("  title: string;") && models.includes('if (typeof title !== "string") return null;'));
      ok("a boolean default reads the default", models.includes("  done: boolean;") && models.includes("let doneValue: boolean = false;"));
      ok("an optional string is nullable", models.includes("  note: string | null;") && models.includes("let noteValue: string | null = null;"));
      ok("each model gets its class", models.includes("export class NoteRow {") && models.includes("export class ProfileRow {"));
    }

    const before = statSync(first.manifest).mtimeMs;
    const second = await generate(project);
    ok("a second run changes nothing", second !== null && !second.changed);
    eqn("and writes no file", statSync(first.manifest).mtimeMs, before);

    rmSync(join(project, ".light"), { recursive: true, force: true });
    const again = await generate(project);
    ok("the output is deterministic", again !== null && readFileSync(again.manifest, "utf8") === manifest);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
