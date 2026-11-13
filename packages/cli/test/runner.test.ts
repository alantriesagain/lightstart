/**
 * @file The runner: a known command's exit code, unknown command 1, an argument error 2, a thrown
 * error 1, and the context the command receives.
 * Runs under node and natively; the outputs must be identical.
 */
import { Registry, buildContext, defineCommand, runCommand } from "../index.ts";
import type { ArgsSchema, Command, LogLevel, RunOptions } from "../index.ts";
import { emptyDiscovered, silentLogger } from "./_helpers.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const commands: Record<string, Command<ArgsSchema>> = {
  hello: defineCommand<ArgsSchema>({
    description: "Says hello",
    args: { name: { positional: true, default: "world" } },
    run(_ctx, { name }) {
      return name === "bad" ? 3 : 0;
    },
  }),
  fail: defineCommand({
    description: "Throws",
    run() {
      throw new Error("boom");
    },
  }),
};

const registry = new Registry("light", commands, emptyDiscovered(), silentLogger);
const level: LogLevel = "silent";
const opts: RunOptions = { name: "light", projectDir: "/tmp/project", cliDir: "/tmp/cli", registry, level };

eqn("a known command answers its code", await runCommand("hello", ["alice"], opts), 0);
eqn("a command's own number is the code", await runCommand("hello", ["bad"], opts), 3);
eqn("an unknown command answers 1", await runCommand("nope", [], opts), 1);
eqn("an argument error answers 2", await runCommand("hello", ["--unknown"], opts), 2);
eqn("a thrown error answers 1", await runCommand("fail", [], opts), 1);

const ctx = buildContext(opts, registry, (name: string, args: readonly string[] = []): Promise<number> => runCommand(name, args, opts), []);
eq("the context names the project", ctx.projectDir, "/tmp/project");
eq("the context names the CLI folder", ctx.cliDir, "/tmp/cli");
ok("the context has a logger", typeof ctx.log.log === "function");
ok("the context has env", typeof ctx.env === "object");
ok("the context has formatBytes", ctx.formatBytes(1536) === "1.5 KB");
ok("the context has the CLI api", typeof ctx.cli.runCommand === "function" && typeof ctx.cli.runHook === "function" && typeof ctx.cli.loadRoutes === "function");
eqn("cli.runCommand invokes another command", await ctx.cli.runCommand("hello", ["bob"]), 0);

done();
