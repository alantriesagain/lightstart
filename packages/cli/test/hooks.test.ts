/**
 * @file Hooks: files load on the first dispatch, every handler runs in order, a throwing one is
 * warned and counted, and returned teardowns run last first, each isolated.
 * Runs under node and natively; the outputs must be identical.
 */
import { Registry, buildContext, runCommand } from "../index.ts";
import type { CommandContext, LogLevel } from "../index.ts";
import { TestLoader, captureLogger, emptyDiscovered, silentLogger, source } from "./_helpers.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

class Payload {
  log: string[] = [];
  fail = "";
}

const project = (_ctx: CommandContext, payload: unknown): unknown => {
  const value = payload as Payload;
  value.log.push("<project>");
  return () => {
    value.log.push("teardown <project>");
  };
};

const alpha = (_ctx: CommandContext, payload: unknown): unknown => {
  const value = payload as Payload;
  value.log.push("alpha");
  if (value.fail === "alpha") throw new Error("alpha failed");
  return () => {
    value.log.push("teardown alpha");
  };
};

const beta = (_ctx: CommandContext, payload: unknown): unknown => {
  const value = payload as Payload;
  value.log.push("beta");
  return () => {
    value.log.push("teardown beta");
    throw new Error("beta teardown failed");
  };
};

const loader = new TestLoader();
loader.add("project.ts", { default: project });
loader.add("alpha.ts", { default: alpha });
loader.add("beta.ts", { default: beta });

const discovered = emptyDiscovered();
discovered.loader = loader;
discovered.hooks.set("serve:after", [
  { file: "project.ts", source: source("<project>") },
  { file: "alpha.ts", source: source("@lightstart/alpha") },
  { file: "beta.ts", source: source("@lightstart/beta") },
]);
const registry = new Registry("light", {}, discovered, silentLogger);
const level: LogLevel = "silent";
const opts = { name: "light", projectDir: "/tmp/project", cliDir: "", registry, level };
const ctx = buildContext(opts, registry, (name: string, args: readonly string[] = []) => runCommand(name, args, opts), []);
const log = captureLogger();
ctx.log = { log: log.log, warn: log.warn, error: log.error, debug: log.debug };

const payload = new Payload();
const run = await ctx.cli.runHook("serve:after", payload);
eq("every handler ran in order", JSON.stringify(payload.log), '["<project>","alpha","beta"]');
eq("every handler was counted", String(run.ran), "3");
eq("none failed", String(run.failed), "0");
await run.teardown();
eq("teardowns ran last first", JSON.stringify(payload.log), '["<project>","alpha","beta","teardown beta","teardown alpha","teardown <project>"]');
eq("a failing teardown warns", JSON.stringify(log.messages.filter((m) => m.text.includes("teardown:")).map((m) => m.text)), '["[serve:after] @lightstart/beta teardown: beta teardown failed"]');

const failing = new Payload();
failing.fail = "alpha";
const second = await ctx.cli.runHook("serve:after", failing);
eq("a throwing handler does not stop the next", JSON.stringify(failing.log), '["<project>","alpha","beta"]');
eq("a throwing handler is counted", String(second.failed), "1");
eqn("a throwing handler is warned with its source", log.messages.filter((m) => m.text === "[serve:after] @lightstart/alpha: alpha failed").length, 1);
await second.teardown();
eq("a failed handler contributes no teardown", JSON.stringify(failing.log), '["<project>","alpha","beta","teardown beta","teardown <project>"]');

const none = await ctx.cli.runHook("serve:before", new Payload());
ok("a hook nobody declares answers zero", none.ran === 0 && none.failed === 0);
await none.teardown();

done();
