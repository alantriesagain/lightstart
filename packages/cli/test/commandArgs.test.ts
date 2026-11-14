/**
 * @file CommandArgs: a command widens it by declaration merging, so an extension's setup reads
 * the command's parsed arguments beside its own, without a cast.
 * Runs under node and natively; the outputs must be identical.
 */
import { Registry, defineCommand, defineExtension, runCommand } from "../index.ts";
import type { ArgsSchema, Command, LogLevel } from "../index.ts";
import { TestLoader, emptyDiscovered, silentLogger, source } from "./_helpers.ts";
import { done, eq, eqn } from "@light/test/assert.ts";

declare module "../index.ts" {
  interface Extensions {
    typed: { seen: string[] };
  }
  interface CommandArgs {
    typed: { dir: string | undefined; port: string; watch: boolean };
  }
}

const seen: string[] = [];

const commands: Record<string, Command<ArgsSchema>> = {
  typed: defineCommand<ArgsSchema>({
    description: "Typed",
    args: {
      dir: { positional: true },
      port: { default: "3000" },
      watch: { flag: true },
    },
    async run(ctx) {
      await ctx.cli.extend("typed", { seen });
      return 0;
    },
  }),
};

const loader = new TestLoader();
loader.add("typed.ts", {
  default: defineExtension("typed", {
    setup(_ctx, args, api) {
      api.seen.push(`${args.dir}:${args.port}:${String(args.watch)}`);
    },
  }),
});

const discovered = emptyDiscovered();
discovered.loader = loader;
discovered.extensions.set("typed", [{ file: "typed.ts", source: source("@acme/typed"), command: "typed" }]);

const registry = new Registry("light", commands, discovered, silentLogger);
const level: LogLevel = "silent";
const opts = { name: "light", projectDir: "/tmp/project", cliDir: "", registry, level };

eqn("a setup reads the command's parsed arguments", await runCommand("typed", ["app", "--port", "4000", "--watch"], opts), 0);
eq("the command's args reach setup without a cast", JSON.stringify(seen), '["app:4000:true"]');

done();
