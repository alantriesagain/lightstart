// node-only
/**
 * @file The generation over the fixture app: a sorted static import per file,
 * relative from `.light`, the manifest names its folders give it, and a second
 * run that writes nothing.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { generate } from "../node/generate.ts";

const fixture = fileURLToPath(new URL("./fixtures/web", import.meta.url));
const components = fileURLToPath(new URL("../../components", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-generate-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  return project;
};

/** A copy of the fixture whose project depends on `@lightstart/components`, linked from this checkout. */
const copyWithComponents = (): string => {
  const project = copy();
  const source = join(fixture, "node_modules");
  const modules = join(project, "node_modules");
  mkdirSync(modules);
  for (const name of readdirSync(source)) {
    if (name === "@lightstart") {
      mkdirSync(join(modules, name));
      for (const sub of readdirSync(join(source, name))) symlinkSync(join(source, name, sub), join(modules, name, sub), "dir");
    } else symlinkSync(join(source, name), join(modules, name), "dir");
  }
  symlinkSync(components, join(modules, "@lightstart", "components"), "dir");
  const manifest = readFileSync(join(project, "package.json"), "utf8");
  const pkg = JSON.parse(manifest) as { dependencies?: Record<string, string> };
  pkg.dependencies = { ...(pkg.dependencies ?? {}), "@lightstart/components": "workspace:*" };
  writeFileSync(join(project, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
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
    ok("a project without the components writes none", !existsSync(join(first.dir, "components.ts")) && !existsSync(join(first.dir, "components.css")));

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

  const withComponents = copyWithComponents();
  try {
    const view = join(withComponents, "src", "views", "app-home.ts");
    writeFileSync(view, 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppHome extends View {\n  render() {\n    return html`<lc-card><lc-text>Home</lc-text></lc-card>`;\n  }\n}\n\nView.register("app-home", AppHome);\n');
    const first = await generate(withComponents);
    ok("the components app has an app", first !== null);
    if (first === null) return done();

    const module = readFileSync(join(first.dir, "components.ts"), "utf8");
    ok("the components module imports View", module.includes('import View from "@lightstart/light";'));
    ok("it imports the tag's module", module.includes('import lcCard from "@lightstart/components/layout/card.js";'));
    ok("it defines the base before the tag", module.indexOf("View.define(lcContainer);") < module.indexOf("View.define(lcCard);"));
    ok("it defines the used tag before the tag", module.indexOf("View.define(lcIcon);") < module.indexOf("View.define(lcCard);"));
    eq("the order is topological with ties by tag", module, 'import View from "@lightstart/light";\nimport lcContainer from "@lightstart/components/layout/container.js";\nimport lcIcon from "@lightstart/components/display/icon.js";\nimport lcCard from "@lightstart/components/layout/card.js";\nimport lcText from "@lightstart/components/display/text.js";\n\nView.define(lcContainer);\nView.define(lcIcon);\nView.define(lcCard);\nView.define(lcText);\n');

    eq("the style module has the theme first, then each stylesheet", readFileSync(join(first.dir, "components.css"), "utf8"), '@import "../node_modules/@lightstart/light/theme/theme.css";\n@import "../node_modules/@lightstart/components/layout/container.css";\n@import "../node_modules/@lightstart/components/display/icon.css";\n@import "../node_modules/@lightstart/components/layout/card.css";\n@import "../node_modules/@lightstart/components/display/text.css";\n');

    const manifest = readFileSync(first.manifest, "utf8");
    const importAt = manifest.indexOf('import "./components.ts";');
    ok("app.ts imports the components", importAt >= 0);
    ok("the components import is before the views", importAt < manifest.indexOf('import "../src/views/app-home.ts";'));

    const second = await generate(withComponents);
    ok("a second components run changes nothing", second !== null && !second.changed);

    writeFileSync(view, 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppHome extends View {\n  render() {\n    return html`<p>Home</p>`;\n  }\n}\n\nView.register("app-home", AppHome);\n');
    const cleared = await generate(withComponents);
    ok("a project with no tag removes the components files", cleared !== null && cleared.changed && !existsSync(join(cleared.dir, "components.ts")) && !existsSync(join(cleared.dir, "components.css")));
    ok("and app.ts no longer imports them", cleared !== null && !readFileSync(cleared.manifest, "utf8").includes('import "./components.ts";'));
  } finally {
    rmSync(withComponents, { recursive: true, force: true });
  }
  done();
};

await main();
