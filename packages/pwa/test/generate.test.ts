// node-only
/**
 * @file The web generation's PWA part: a project with `src/pwa.ts` or
 * `src/pwa.js` gets the config import and the `registerPwa` call in
 * `.light/main`, a project without one gets neither, and a project with the
 * config but without the package is an error naming it. The package's tag
 * table defines `<pwa-update-toast>`.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, ok } from "@lightstart/test/assert.ts";
import { generate } from "@lightstart/app/node/generate.ts";

const fixture = fileURLToPath(new URL("./fixtures/app", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-pwa-generate-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const withoutDependency = (project: string): void => {
  const path = join(project, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8")) as { dependencies?: Record<string, string> };
  if (pkg.dependencies !== undefined) delete pkg.dependencies["@lightstart/pwa"];
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
};

const main = async (): Promise<void> => {
  const javascript = copy();
  try {
    const generated = await generate(javascript);
    ok("the JavaScript fixture generates", generated !== null);
    if (generated === null) return done();
    const main = readFileSync(generated.main, "utf8");
    ok("a JavaScript project imports its PWA config", main.includes('import pwaConfig from "../src/pwa.js";'));
    ok("the entry imports registerPwa from the page module", main.includes('import { registerPwa } from "@lightstart/pwa/page";'));
    ok("it registers with the app's base after start answers", main.includes("registerPwa(pwaConfig, { base: \"\" });") && main.indexOf("registerPwa(pwaConfig") > main.indexOf("await start(manifest"));

    writeFileSync(
      join(javascript, "src", "views", "app-home.js"),
      'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppHome extends View {\n  render() {\n    return html`<pwa-update-toast></pwa-update-toast>`;\n  }\n}\n\nView.register("app-home", AppHome);\n',
    );
    const tagged = await generate(javascript);
    ok("a project writing the toast generates", tagged !== null);
    if (tagged !== null) {
      const components = readFileSync(join(tagged.dir, "components.js"), "utf8");
      ok("the tag table imports the toast module", components.includes('import pwaUpdateToast from "@lightstart/pwa/views/update-toast.ts";'));
      ok("the tag table defines the toast", components.includes("View.define(pwaUpdateToast);"));
      const style = readFileSync(join(tagged.dir, "components.css"), "utf8");
      ok("the tag table imports the toast stylesheet", style.includes('@import "../node_modules/@lightstart/pwa/views/update-toast.css";'));
    }
  } finally {
    rmSync(javascript, { recursive: true, force: true });
  }

  const typed = copy();
  try {
    writeFileSync(join(typed, "src", "pwa.ts"), 'import { definePwa } from "@lightstart/pwa";\n\nexport default definePwa({ short_name: "PWA" });\n');
    rmSync(join(typed, "src", "pwa.js"));
    const generated = await generate(typed);
    ok("a TypeScript PWA config generates", generated !== null);
    if (generated !== null) ok("the entry imports the TypeScript config", readFileSync(generated.main, "utf8").includes('import pwaConfig from "../src/pwa.ts";'));
  } finally {
    rmSync(typed, { recursive: true, force: true });
  }

  const plain = copy();
  try {
    rmSync(join(plain, "src", "pwa.js"));
    withoutDependency(plain);
    const generated = await generate(plain);
    ok("a project without src/pwa generates", generated !== null);
    if (generated !== null) {
      const main = readFileSync(generated.main, "utf8");
      ok("it imports no PWA config", !main.includes("pwaConfig"));
      ok("it registers no worker", !main.includes("registerPwa"));
    }
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }

  const undeclared = copy();
  try {
    withoutDependency(undeclared);
    const message = await generate(undeclared).then(
      () => "",
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
    ok("a PWA config without the package is an error naming it", message.includes("@lightstart/pwa"));
    ok("the error names the config file", message.includes("src/pwa.js"));
  } finally {
    rmSync(undeclared, { recursive: true, force: true });
  }
  done();
};

await main();
