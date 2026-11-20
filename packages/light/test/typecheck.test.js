/**
 * @file `light typecheck`: `tsc --noEmit` over the project's tsconfig, its own TypeScript first.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import { typecheckProject } from "../cli/typecheck.js";

const quiet = { error: () => undefined };

const config = {
  compilerOptions: { target: "es2024", module: "esnext", moduleResolution: "bundler", strict: true, noEmit: true },
  include: ["src"],
};

test("typecheck passes clean sources and fails a type error", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "light-typecheck-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "typecheck-fixture", type: "module" }));
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify(config));
  const file = join(dir, "src", "index.ts");
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(file, "export const value: number = 1;\n");
  assert.equal(await typecheckProject(dir, { log: quiet }), 0);
  writeFileSync(file, 'export const value: number = "one";\n');
  assert.notEqual(await typecheckProject(dir, { log: quiet }), 0);
});

test("typecheck needs a tsconfig", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "light-typecheck-none-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "typecheck-none", type: "module" }));
  assert.equal(await typecheckProject(dir, { log: quiet }), 1);
});

test("any Emitter<T> is an Occurrence a resource's invalidateOn accepts", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "light-typecheck-occurrence-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const light = fileURLToPath(new URL("../", import.meta.url));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "typecheck-occurrence", type: "module" }));
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({
    compilerOptions: { ...config.compilerOptions, allowImportingTsExtensions: true, skipLibCheck: true },
    include: ["src"],
  }));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "index.ts"), [
    `import { event } from "${light}signals/event.ts";`,
    `import { resource } from "${light}controller/resource.ts";`,
    `import type { Occurrence } from "${light}controller/types.ts";`,
    "const typed = event<{ collection: string }>();",
    "const bare = event();",
    "export const one: Occurrence = typed;",
    "export const two: Occurrence = bare;",
    "export const r = resource(async () => 1, { invalidateOn: [typed, bare, event<unknown>()] });",
    "",
  ].join("\n"));
  assert.equal(await typecheckProject(dir, { log: quiet }), 0);
});
