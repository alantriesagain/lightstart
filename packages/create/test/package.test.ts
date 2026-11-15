// node-only
/**
 * @file End to end: `light new package demo` with the install, then the package's own `test`,
 * `typecheck`, `check` and `pack` scripts in the new project. The pack stages `dist/` with a
 * `.js` and a `.d.ts` per module and a manifest whose exports name both.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
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

  const temp = mkdtempSync(join(tmpdir(), "create-package-"));
  const target = join(temp, "demo");
  try {
    const created = await run(process.execPath, [join(root, "packages", "cli", "bin", "light.js"), "new", "package", "demo", "--dir", target, "--light", root], root);
    ok("light new exits 0", created.code === 0);
    if (created.code !== 0) {
      console.log(created.output);
      return;
    }
    for (const file of ["package.json", "index.ts", "test/index.test.ts", "scripts/pack.js", "tsconfig.json", "README.md", "AGENTS.md", ".gitignore"]) ok(`the project has ${file}`, existsSync(join(target, file)));

    const manifest = JSON.parse(readFileSync(join(target, "package.json"), "utf8")) as { scripts: Record<string, string>; devDependencies: Record<string, string> };
    eq("the test script runs node's runner", manifest.scripts.test, "node --test test/*.test.ts");
    eq("the typecheck script runs tsc", manifest.scripts.typecheck, "tsc -p tsconfig.json");
    eq("the check script runs light check", manifest.scripts.check, "light check");
    eq("the pack script stages into dist", manifest.scripts.pack, "node scripts/pack.js");
    ok("the cli is a devDependency", manifest.devDependencies["@lightstart/cli"] !== undefined);
    ok("typescript is a devDependency", manifest.devDependencies.typescript !== undefined);

    const test = await run("pnpm", ["run", "test"], target);
    ok("pnpm test exits 0", test.code === 0);
    if (test.code !== 0) console.log(test.output);

    const typecheck = await run("pnpm", ["run", "typecheck"], target);
    ok("pnpm typecheck exits 0", typecheck.code === 0);
    if (typecheck.code !== 0) console.log(typecheck.output);

    const check = await run("pnpm", ["run", "check"], target);
    ok("pnpm check exits 0", check.code === 0);
    if (check.code !== 0) console.log(check.output);

    const pack = await run("pnpm", ["run", "pack"], target);
    ok("pnpm pack exits 0", pack.code === 0);
    if (pack.code !== 0) console.log(pack.output);

    for (const file of ["dist/package.json", "dist/index.js", "dist/index.d.ts", "dist/README.md"]) ok(`the pack stages ${file}`, existsSync(join(target, file)));
    ok("the pack writes a tarball", readdirSync(join(target, "dist")).some((file) => file.endsWith(".tgz")));
    const staged = JSON.parse(readFileSync(join(target, "dist", "package.json"), "utf8")) as { exports: Record<string, unknown>; files?: string[] };
    eq("the staged exports name types and default", JSON.stringify(staged.exports["."]), JSON.stringify({ types: "./index.d.ts", default: "./index.js" }));
    eq("the staged files are the build", JSON.stringify(staged.files), JSON.stringify(["**/*.js", "**/*.d.ts"]));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
};

await main();
done();
