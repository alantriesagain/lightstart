/**
 * @file The native entry: the core with a static command table and no discovery. It proves the
 * binary and gives the benchmark a stable program.
 */
import { createCli, defineCommand } from "../index.ts";
import type { ArgsSchema, Command } from "../index.ts";

const VERSION = "0.1.0";

const commands: Record<string, Command<ArgsSchema>> = {
  version: defineCommand({
    description: "Print the version",
    run(ctx) {
      ctx.log.log(VERSION);
      return 0;
    },
  }),
  echo: defineCommand<ArgsSchema>({
    description: "Print the words given, optionally uppercased or as JSON",
    args: {
      label: { default: "", short: "l", description: "A label before the words" },
      mode: { choices: ["plain", "json"], default: "plain", short: "m", description: "plain or json" },
      upper: { flag: true, short: "u", description: "Uppercase the words" },
      text: { positional: true, rest: true, description: "The words to print" },
    },
    run(ctx, args) {
      const label = typeof args.label === "string" ? args.label : "";
      const mode = args.mode;
      const upper = args.upper === true;
      const text = args.text;
      const words = Array.isArray(text) ? text.join(" ") : "";
      const value = upper ? words.toUpperCase() : words;
      if (mode === "json") ctx.log.log(JSON.stringify({ label, text: value }));
      else ctx.log.log(label ? `${label}: ${value}` : value);
      return 0;
    },
  }),
};

const cli = createCli({
  name: "light",
  version: VERSION,
  scopes: ["@lightstart"],
  envPrefix: "LIGHT",
  commands,
});

process.exitCode = await cli.main(process.argv.slice(2));
