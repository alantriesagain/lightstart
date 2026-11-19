// node-only
/**
 * @file `light new model|view|controller` inside a JavaScript web app, a
 * TypeScript web app and a tui app: each command writes the scaffold's shape,
 * the app still passes check and typecheck, and a second model of the same
 * name is refused.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findCheckout } from "../generate.ts";
import { done, ok } from "@lightstart/test/assert.ts";

type Run = { code: number | null; output: string };

const run = (command: string, args: readonly string[], cwd: string): Promise<Run> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });

type Variant = { name: string; kind: "web" | "tui"; flag: string; ext: "js" | "ts" };

const variants: readonly Variant[] = [
  { name: "pieces-web", kind: "web", flag: "", ext: "js" },
  { name: "pieces-web-ts", kind: "web", flag: "--ts", ext: "ts" },
  { name: "pieces-tui", kind: "tui", flag: "", ext: "ts" },
];

const main = async (): Promise<void> => {
  const root = findCheckout();
  ok("the tests run from a checkout", root !== null);
  if (root === null) return;

  const light = join(root, "packages", "cli", "bin", "light.js");
  const temp = mkdtempSync(join(tmpdir(), "create-pieces-"));
  try {
    for (const variant of variants) {
      const target = join(temp, variant.name);
      const label = `${variant.name}: `;
      const created = await run(process.execPath, [light, "new", variant.kind, variant.name, "--dir", target, "--light", root, ...(variant.flag === "" ? [] : [variant.flag])], root);
      ok(`${label}light new exits 0`, created.code === 0);
      if (created.code !== 0) {
        console.log(created.output);
        continue;
      }

      const model = await run(process.execPath, [light, "new", "model", "note2", "--fields", "title:string,done:boolean"], target);
      ok(`${label}light new model exits 0`, model.code === 0);
      if (model.code !== 0) console.log(model.output);

      const controller = await run(process.execPath, [light, "new", "controller", "notes2", "--model", "note2"], target);
      ok(`${label}light new controller exits 0`, controller.code === 0);
      if (controller.code !== 0) console.log(controller.output);

      const view = await run(process.execPath, [light, "new", "view", "note-list"], target);
      ok(`${label}light new view exits 0`, view.code === 0);
      if (view.code !== 0) console.log(view.output);

      const files = [`src/models/note2.${variant.ext}`, `src/controllers/notes2.${variant.ext}`, `src/views/note-list.${variant.ext}`];
      for (const file of files) ok(`${label}the app has ${file}`, existsSync(join(target, file)));

      const modelSource = existsSync(join(target, files[0])) ? readFileSync(join(target, files[0]), "utf8") : "";
      ok(`${label}the model names its fields`, modelSource.includes("title:") && modelSource.includes("done:"));
      const controllerSource = existsSync(join(target, files[1])) ? readFileSync(join(target, files[1]), "utf8") : "";
      ok(`${label}the controller follows the model`, controllerSource.includes("liveRows"));
      const viewSource = existsSync(join(target, files[2])) ? readFileSync(join(target, files[2]), "utf8") : "";
      ok(`${label}the view registers its tag`, viewSource.includes("note-list"));

      const again = await run(process.execPath, [light, "new", "model", "note2", "--fields", "title:string"], target);
      ok(`${label}a second model is refused`, again.code !== 0);

      const checked = await run("pnpm", ["run", "check"], target);
      ok(`${label}the app's check passes`, checked.code === 0);
      if (checked.code !== 0) console.log(checked.output);

      const typed = await run("pnpm", ["run", "typecheck"], target);
      ok(`${label}the app's typecheck passes`, typed.code === 0);
      if (typed.code !== 0) console.log(typed.output);

      const linted = await run("pnpm", ["run", "lint"], target);
      ok(`${label}the app's lint passes`, linted.code === 0);
      if (linted.code !== 0) console.log(linted.output);

      if (variant.kind === "tui") {
        const tested = await run(process.execPath, [light, "test", "--node-only"], target);
        ok(`${label}the app's node test passes`, tested.code === 0);
        if (tested.code !== 0) console.log(tested.output);
      }
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
};

await main();
done();
