// node-only
/**
 * @file The worker fixture's generation: `.light/worker.js` imports the app and
 * its models and serves them, `.light/main.js` starts with the worker stores
 * feature, and a project without `worker: true` gets the local stores.
 */

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, ok } from "@lightstart/test/assert.ts";
import { generate } from "../node/generate.ts";

const fixture = fileURLToPath(new URL("./fixtures/worker", import.meta.url));
const plain = fileURLToPath(new URL("./fixtures/web-js", import.meta.url));

const copy = (source: string, label: string): string => {
  const project = mkdtempSync(join(tmpdir(), label));
  cpSync(source, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(source, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const main = async (): Promise<void> => {
  const project = copy(fixture, "light-app-worker-generate-");
  try {
    const generated = await generate(project);
    ok("the worker fixture generates", generated !== null);
    if (generated === null) return done();

    const worker = join(generated.dir, "worker.js");
    ok("generation writes .light/worker.js", existsSync(worker));
    const source = readFileSync(worker, "utf8");
    ok("the worker imports serveModels", source.includes('import { serveModels } from "@lightstart/app/web/worker-entry";'));
    ok("the worker imports the app", source.includes('import app from "../src/app.js";'));
    ok("the worker imports each model", source.includes('import model0 from "../src/models/archive.js";') && source.includes('import model1 from "../src/models/note.js";'));
    ok("the worker serves each model by name", source.includes('"archive": model0,') && source.includes('"note": model1,'));
    ok("the worker imports the project's own worker module", source.includes('import worker from "../src/worker.js";'));
    ok("the worker passes it to serveModels", source.includes("  worker,"));

    const entry = readFileSync(generated.main, "utf8");
    ok("a worker app's entry imports no IndexedDB adapter type", !entry.includes("IndexedDBAdapterType"));
    ok("the entry imports the worker feature", entry.includes('import { WorkerStores } from "@lightstart/app/web/worker.ts";'));
    ok("the entry starts with the worker stores feature", entry.includes('stores: new WorkerStores(() => new Worker(new URL("./worker.js", import.meta.url), { type: "module" })),'));

    const again = await generate(project);
    ok("a second run changes nothing", again !== null && !again.changed);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }

  const bareProject = copy(fixture, "light-app-worker-bare-");
  try {
    rmSync(join(bareProject, "src", "worker.js"), { force: true });
    const generated = await generate(bareProject);
    ok("a worker app without src/worker.js still generates", generated !== null);
    if (generated !== null) {
      const source = readFileSync(join(generated.dir, "worker.js"), "utf8");
      ok("and its worker imports no project worker module", !source.includes("import worker from"));
      ok("and passes none to serveModels", !source.includes("  worker,"));
    }
  } finally {
    rmSync(bareProject, { recursive: true, force: true });
  }

  const plainProject = copy(plain, "light-app-worker-plain-");
  try {
    const generated = await generate(plainProject);
    ok("the plain fixture generates", generated !== null);
    if (generated === null) return done();
    ok("a project without worker: true writes no worker", !existsSync(join(generated.dir, "worker.js")));
    const plainEntry = readFileSync(generated.main, "utf8");
    ok("and its entry starts with local stores", plainEntry.includes('import { LocalStores } from "@lightstart/app/web/local.ts";') && plainEntry.includes("stores: new LocalStores(),"));
    ok("and imports no worker feature", !plainEntry.includes("WorkerStores"));
  } finally {
    rmSync(plainProject, { recursive: true, force: true });
  }
  done();
};

await main();
