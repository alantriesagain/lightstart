// node-only
/**
 * @file The web entry imports exactly the feature modules the app's config
 * uses: nothing for a memory app, the transitions and args modules when it
 * declares them, and the IndexedDB adapter type for a store with no adapter or an adapter
 * that is a function.
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, ok } from "@lightstart/test/assert.ts";
import { generate } from "../node/generate.ts";

const fixture = fileURLToPath(new URL("./fixtures/web-js", import.meta.url));
const typed = fileURLToPath(new URL("./fixtures/web", import.meta.url));

const copy = (source: string): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-web-features-generate-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  const modules = join(project, "node_modules");
  const from = join(typed, "node_modules");
  mkdirSync(modules);
  for (const name of readdirSync(from)) {
    if (name === "@lightstart") {
      mkdirSync(join(modules, name));
      for (const sub of readdirSync(join(from, name))) symlinkSync(realpathSync(join(from, name, sub)), join(modules, name, sub), "dir");
    } else symlinkSync(realpathSync(join(from, name)), join(modules, name), "dir");
  }
  writeFileSync(join(project, "src", "app.js"), source);
  return project;
};

const entryFor = async (source: string): Promise<string> => {
  const project = copy(source);
  try {
    const generated = await generate(project);
    if (generated === null) throw new Error("the fixture did not generate");
    return readFileSync(generated.main, "utf8");
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
};

const APP = (extra: string): string => `import { defineApp } from "@lightstart/app";\n\nexport default defineApp({ name: "fixture-web-js", host: "web", ${extra}stores: { main: { adapter: "memory" } } });\n`;

const main = async (): Promise<void> => {
  const plain = await entryFor(APP(""));
  ok("a memory app imports only the host", !plain.includes("IndexedDBAdapterType") && !plain.includes("Transitions") && !plain.includes("queryArgs") && !plain.includes("WorkerStores"));
  ok("a memory app starts with no options", plain.includes("await start(manifest);"));

  const features = await entryFor(APP('transitions: true, args: { greeting: { default: "hi" } }, '));
  ok("transitions import their module", features.includes('import { Transitions } from "@lightstart/app/web/transitions.ts";'));
  ok("args import the query parser", features.includes('import { queryArgs } from "@lightstart/app/web/args.ts";'));
  ok("transitions and args import no IndexedDB adapter type", !features.includes("IndexedDBAdapterType"));
  ok("the options are passed to start", features.includes("transitions: new Transitions(),") && features.includes("args: queryArgs,"));

  const implied = await entryFor('import { defineApp } from "@lightstart/app";\n\nexport default defineApp({ name: "fixture-web-js", host: "web" });\n');
  ok("a store with no adapter imports the IndexedDB adapter type", implied.includes('import { IndexedDBAdapterType } from "@lightstart/app/web/indexeddb.ts";'));
  ok("and passes its adapter types", implied.includes("adapters: [new IndexedDBAdapterType()],"));

  const chosen = await entryFor('import { defineApp } from "@lightstart/app";\n\nexport default defineApp({ name: "fixture-web-js", host: "web", stores: { main: { adapter: (args) => (args.flag("memory") ? "memory" : "indexeddb") } } });\n');
  ok("an adapter that is a function imports every web adapter type", chosen.includes("IndexedDBAdapterType"));
  done();
};

await main();
