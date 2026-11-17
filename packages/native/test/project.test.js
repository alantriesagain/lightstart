/* eslint-disable light/no-non-jsdoc-comments */
// node-only
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { scriptcPath } from "@lightstart/light/native/scriptc.js";
import { dependencyClosure, findProject, isInstalled } from "../src/project.js";
import { prepareProject } from "../src/prepare.js";

const fixtures = resolve(import.meta.dirname, "fixtures");
const projectDir = join(fixtures, "project");

test("the project is the nearest package.json with a native block", () => {
  const nested = join(projectDir, "src", "deep");
  const project = findProject(nested);
  assert.equal(project.dir, projectDir);
  assert.equal(project.name, "fixture-project");

  const saved = process.env["LIGHT_PROJECT_DIR"];
  process.env["LIGHT_PROJECT_DIR"] = nested;
  try {
    assert.equal(findProject().dir, projectDir);
  } finally {
    if (saved === undefined) delete process.env["LIGHT_PROJECT_DIR"];
    else process.env["LIGHT_PROJECT_DIR"] = saved;
  }

  const empty = mkdtempSync(join(tmpdir(), "native-no-project-"));
  assert.throws(() => findProject(empty), /not inside a native project/);
});

test("dependencies are a closure through linked and installed folders", () => {
  const project = findProject(projectDir);
  const dependencies = dependencyClosure(project);
  assert.deepEqual(
    dependencies.map((dependency) => dependency.name),
    ["@acme/base", "@acme/linked", "@acme/real"],
  );
  const byName = new Map(dependencies.map((dependency) => [dependency.name, dependency]));
  const real = byName.get("@acme/real");
  const linked = byName.get("@acme/linked");
  const base = byName.get("@acme/base");
  assert.ok(real !== undefined && linked !== undefined && base !== undefined);
  assert.equal(isInstalled(real), true);
  assert.equal(isInstalled(linked), false);
  assert.equal(isInstalled(base), false);
});

test("prepare runs a linked closure in order, skips an installed folder and runs each once", async () => {
  const log = join(mkdtempSync(join(tmpdir(), "native-prepare-")), "prepare.log");
  writeFileSync(log, "");
  const saved = process.env["PREPARE_LOG"];
  process.env["PREPARE_LOG"] = log;
  /** @type {string[]} */
  const messages = [];
  const original = console.log;
  console.log = (...parts) => messages.push(parts.join(" "));
  try {
    const project = findProject(projectDir);
    await prepareProject(project, "prepare");
    assert.deepEqual(readFileSync(log, "utf8").trim().split("\n"), ["base", "linked", "project"]);
    const once = readFileSync(log, "utf8");
    await prepareProject(project, "prepare");
    assert.equal(readFileSync(log, "utf8"), once);
    assert.ok(messages.some((message) => message.includes("@acme/real") && message.includes("expected prebuilt")));
  } finally {
    console.log = original;
    if (saved === undefined) delete process.env["PREPARE_LOG"];
    else process.env["PREPARE_LOG"] = saved;
  }
});

test("the compiler is $SCRIPTC, the project's, else the one beside @lightstart/native", () => {
  const saved = process.env["SCRIPTC"];
  const dir = mkdtempSync(join(tmpdir(), "native-scriptc-"));
  try {
    process.env["SCRIPTC"] = "/tmp/named-scriptc";
    assert.equal(scriptcPath(dir), "/tmp/named-scriptc");

    delete process.env["SCRIPTC"];
    mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
    const local = join(dir, "node_modules", ".bin", "scriptc");
    writeFileSync(local, "");
    assert.equal(scriptcPath(dir), local);

    const bare = mkdtempSync(join(tmpdir(), "native-scriptc-bare-"));
    const fallback = scriptcPath(bare);
    assert.ok(fallback.endsWith(join("node_modules", ".bin", "scriptc")));
    assert.ok(existsSync(fallback));
  } finally {
    if (saved === undefined) delete process.env["SCRIPTC"];
    else process.env["SCRIPTC"] = saved;
  }
});

test("install puts the binary in BIN_DIR, then runs the project's install steps with the binary named", async () => {
  const { installBinary } = await import("../src/commands/install.js");
  const dir = mkdtempSync(join(tmpdir(), "native-install-"));
  const bin = join(dir, "bin");
  const binary = join(dir, "built");
  writeFileSync(binary, "binary");
  const app = { dir, name: "fixture", config: { install: ['printf "%s %s" "$LIGHT_NATIVE_COMMAND" "$LIGHT_INSTALLED" > step.txt'] } };
  const before = process.env["BIN_DIR"];
  process.env["BIN_DIR"] = bin;
  try {
    assert.equal(await installBinary(dir, /** @type {never} */ (app), binary, "fixture"), 0);
  } finally {
    if (before === undefined) delete process.env["BIN_DIR"];
    else process.env["BIN_DIR"] = before;
  }
  assert.equal(readFileSync(join(bin, "fixture"), "utf8"), "binary");
  assert.equal(readFileSync(join(dir, "step.txt"), "utf8"), "install " + join(bin, "fixture"));
});
