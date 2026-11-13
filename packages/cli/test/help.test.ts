/**
 * @file Help: the global listing grouped by source, a command's description, usage and options,
 * and an unknown command's message.
 * Runs under node and natively; the outputs must be identical.
 */
import { Registry, defineCommand, renderHelp } from "../index.ts";
import type { ArgsSchema, Command } from "../index.ts";
import { emptyDiscovered, silentLogger } from "./_helpers.ts";
import { done, eq, ok } from "@light/test/assert.ts";

const commands: Record<string, Command<ArgsSchema>> = {
  hello: defineCommand<ArgsSchema>({
    description: "Says hello",
    args: { name: { positional: true, default: "world", description: "Who to greet" } },
    run() {
      return 0;
    },
  }),
  deploy: defineCommand({
    description: "Deploy a site",
    aliases: ["d"],
    run() {
      return 0;
    },
  }),
};

const registry = new Registry("light", commands, emptyDiscovered(), silentLogger);

const global = await renderHelp(registry, "light");
ok("the title names the CLI", global.includes("light CLI"));
ok("the usage names the CLI", global.includes("Usage: light <command> [args]"));
ok("a command and its description are listed", global.includes("hello") && global.includes("Says hello"));
ok("an alias is not a second entry", (global.match(/deploy/g) ?? []).length === 1);

const one = await renderHelp(registry, "light", "hello");
ok("the command's description comes first", one.startsWith("hello: Says hello"));
ok("the usage names the CLI and the command", one.includes("Usage: light hello [options]"));
ok("a positional is shown", one.includes("<name>"));
ok("its description is shown", one.includes("Who to greet"));
eq("an unknown command answers a message", await renderHelp(registry, "light", "nope"), "Unknown command: nope");

done();
