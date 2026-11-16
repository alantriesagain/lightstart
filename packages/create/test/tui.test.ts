// node-only
/**
 * @file End to end: `light new tui demo` with the install, then the new project's own scripts.
 * The tree holds an app config, a model, a controller, the root view and its row view; `test`
 * drives the app on a test terminal, `check` passes light's native conventions, and `build`
 * compiles the generated entry to one native binary with scriptc.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findCheckout } from "../generate.ts";
import { done, eq, ok } from "@lightstart/test/assert.ts";

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

const main = async (): Promise<void> => {
  const root = findCheckout();
  ok("the tests run from a checkout", root !== null);
  if (root === null) return;

  const temp = mkdtempSync(join(tmpdir(), "create-tui-"));
  const target = join(temp, "demo");
  try {
    const created = await run(process.execPath, [join(root, "packages", "cli", "bin", "light.js"), "new", "tui", "demo", "--dir", target, "--light", root], root);
    ok("light new exits 0", created.code === 0);
    if (created.code !== 0) {
      console.log(created.output);
      return;
    }

    for (const file of [
      "package.json",
      "tsconfig.json",
      ".npmrc",
      ".gitignore",
      "src/app.ts",
      "src/models/todo.ts",
      "src/controllers/todos.ts",
      "src/views/app-root.ts",
      "src/views/todo-row.ts",
      "test/app.test.ts",
      "README.md",
      "AGENTS.md",
    ])
      ok(`the project has ${file}`, existsSync(join(target, file)));

    const manifest = JSON.parse(readFileSync(join(target, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      native: { entry: string; binary: string; prepare: string[] };
    };
    ok("the manifest links light", manifest.dependencies["@lightstart/light"]?.startsWith("link:") === true);
    ok("the manifest links the app layer", manifest.dependencies["@lightstart/app"]?.startsWith("link:") === true);
    eq("the native entry is the generated one", manifest.native?.entry, ".light/main.ts");
    eq("the binary is named after the project", manifest.native?.binary, "demo");
    eq("the prepare step generates the app", JSON.stringify(manifest.native?.prepare), JSON.stringify(["light app"]));
    eq("the scripts are the kind's", Object.keys(manifest.scripts).join(","), "dev,test,build,check");
    eq("dev runs the app", manifest.scripts["dev"], "light run");
    eq("test runs light test under node and natively", manifest.scripts["test"], "light test");
    eq("build runs light build", manifest.scripts["build"], "light build");
    eq("check runs light check", manifest.scripts["check"], "light check");
    ok("native is a devDependency", manifest.devDependencies["@lightstart/native"] !== undefined);
    ok("build is a devDependency", manifest.devDependencies["@lightstart/build"] !== undefined);
    eq("scriptc is pinned", manifest.devDependencies["scriptc"], "0.4.12");

    await run("pnpm", ["rebuild", "scriptc", "--config.ignore-scripts=false"], target);
    const tested = await run("pnpm", ["run", "test"], target);
    ok("the project's test exits 0", tested.code === 0);
    if (tested.code !== 0) console.log(tested.output);

    const checked = await run("pnpm", ["run", "check"], target);
    ok("the project's check exits 0", checked.code === 0);
    if (checked.code !== 0) console.log(checked.output);

    const built = await run("pnpm", ["run", "build"], target);
    ok("the project's build exits 0", built.code === 0);
    if (built.code !== 0) console.log(built.output);
    const binary = join(target, "dist", "demo");
    ok("the build writes dist/demo, named after the project", existsSync(binary));
    if (existsSync(binary)) ok("the binary is a file", statSync(binary).isFile());
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
};

await main();
done();
