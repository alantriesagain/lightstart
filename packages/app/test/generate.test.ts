// node-only
/**
 * @file The generation over the fixture app: a sorted static import per file,
 * relative from `.light`, the manifest names its folders give it, and a second
 * run that writes nothing.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { generate } from "../node/generate.ts";

const fixture = fileURLToPath(new URL("./fixtures/web", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-generate-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  return project;
};

const main = async (): Promise<void> => {
  const project = copy();
  try {
    const first = await generate(project);
    ok("the fixture has an app", first !== null);
    if (first === null) return done();

    ok("it finds the note model", first.models.join(",") === "note");
    ok("it finds the notes controller", first.controllers.join(",") === "notes");
    eq("it sorts the views", first.views.join(","), "app-about,app-home,app-legal,app-root");
    ok("it finds the routes", first.routes);
    ok("the first run wrote", first.changed);

    const source = readFileSync(first.manifest, "utf8");
    ok("the model import is relative from .light", source.includes('import model0 from "../src/models/note.ts";'));
    ok("the controller import is relative from .light", source.includes('import controller0 from "../src/controllers/notes.ts";'));
    ok("the route import is relative from .light", source.includes('import routes from "../src/routes.ts";'));
    ok("a view import is relative and side-effect only", source.includes('import "../src/views/app-root.ts";'));
    ok("the model keeps its file name", source.includes('{ name: "note", model: model0 }'));
    ok("the controller keeps its file name", source.includes('{ name: "notes", controller: controller0 }'));
    ok("the views are named", source.includes('views: ["app-about", "app-home", "app-legal", "app-root"]'));
    eq("the entry starts the web host", readFileSync(first.main, "utf8"), 'import { start } from "@lightstart/app/web";\nimport manifest from "./app.ts";\n\nawait start(manifest);\n');

    const before = statSync(first.manifest).mtimeMs;
    const second = await generate(project);
    ok("a second run changes nothing", second !== null && !second.changed);
    eqn("and writes no file", statSync(first.manifest).mtimeMs, before);

    rmSync(join(project, ".light"), { recursive: true, force: true });
    const again = await generate(project);
    ok("the output is deterministic", again !== null && readFileSync(again.manifest, "utf8") === source);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
