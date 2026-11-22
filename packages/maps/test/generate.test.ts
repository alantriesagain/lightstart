// node-only
/**
 * @file The web generation's maps part: a fixture app writing `<maps-view>`
 * gets the view module defined and its stylesheet imported from the package's
 * tag table.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, ok } from "@lightstart/test/assert.ts";
import { generate } from "@lightstart/app/node/generate.ts";

const fixture = fileURLToPath(new URL("./fixtures/app", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-maps-generate-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const project = copy();
try {
  const generated = await generate(project);
  ok("the fixture app generates", generated !== null);
  if (generated !== null) {
    const components = readFileSync(join(generated.dir, "components.js"), "utf8");
    ok("the tag table imports the view module", components.includes('import mapsView from "@lightstart/maps/views/view.js";'));
    ok("the tag table defines the view", components.includes("View.define(mapsView);"));
    const style = readFileSync(join(generated.dir, "components.css"), "utf8");
    ok("the tag table imports the view stylesheet", style.includes('@import "../node_modules/@lightstart/maps/views/view.css";'));
  }
} finally {
  rmSync(project, { recursive: true, force: true });
}
done();
