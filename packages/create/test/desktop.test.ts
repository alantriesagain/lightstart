// node-only
/**
 * @file End to end: `light new desktop demo` with the install, then the project's own `test` and
 * `check` scripts. The window itself needs WebKitGTK and a display, so `dev` and `build` are not
 * run here.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

  const temp = mkdtempSync(join(tmpdir(), "create-desktop-"));
  const target = join(temp, "demo");
  try {
    const created = await run(process.execPath, [join(root, "packages", "cli", "bin", "light.js"), "new", "desktop", "demo", "--dir", target, "--light", root], root);
    ok("light new desktop exits 0", created.code === 0);
    if (created.code !== 0) {
      console.log(created.output);
      return;
    }

    for (const file of ["package.json", "backend.ts", "system.ts", "contract.ts", "web/index.html", "web/main.ts", "web/app.js", "web/styles.css", "test/system.test.ts", "README.md", "AGENTS.md", ".gitignore"])
      ok(`the project has ${file}`, existsSync(join(target, file)));

    const manifest = JSON.parse(readFileSync(join(target, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    eq("the scripts", Object.keys(manifest.scripts).join(","), "dev,build,test,check");
    ok("dev runs the app", manifest.scripts.dev?.startsWith("light desktop run") === true);
    ok("build runs the desktop build", manifest.scripts.build?.startsWith("light desktop build") === true);
    ok("the manifest links light", manifest.dependencies["@lightstart/light"]?.startsWith("link:") === true);
    ok("the manifest links the components", manifest.dependencies["@lightstart/components"]?.startsWith("link:") === true);
    ok("scriptc is a devDependency", manifest.devDependencies["scriptc"] === "0.4.12");
    ok("server is a devDependency", manifest.devDependencies["@lightstart/server"] !== undefined);

    const tested = await run("pnpm", ["run", "test"], target);
    ok("the project's test script passes", tested.code === 0);
    if (tested.code !== 0) console.log(tested.output);

    const checked = await run("pnpm", ["run", "check"], target);
    ok("the project's check script passes", checked.code === 0);
    if (checked.code !== 0) console.log(checked.output);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
};

await main();
done();
