/**
 * @file The `light-native` command: one subcommand per module in commands/, each given the parsed
 * arguments and the workspace root: the nearest folder above the current one with a
 * pnpm-workspace.yaml, else light's, which this CLI is part of.
 */
import { findRoot, LIGHT } from "./workspace.js";

const COMMANDS = {
  prepare: "the prepare steps of the members named (default: every app) and of the packages they depend on",
  build: "build an app into its dist/ with scriptc",
  run: "build an app and run it in the folder the command was launched from",
  selftest: "build an app and run one of its selftest scenarios in a pseudo-terminal on a temp repository",
  test: "run the members' tests under node and natively; the outputs must match",
  coverage: "scriptc's static coverage of every app entry and every test: all must compile fully statically",
  typecheck: "tsc per member (--all, or the members named)",
  check: "the conventions every member follows: imports by name and declared, .ts exports, the tsconfig template, tests (--all, or the members named)",
  probes: "the compiler probes in the workspace's probes/, node against native, written to probes/RESULTS.md",
  install: "build an app and copy it into ~/.local/bin",
  desktop: "build a desktop app with light's desktop shell and run it (or its selftest)",
};

const workspaceRoot = () => {
  try {
    return findRoot(process.cwd());
  } catch {
    return LIGHT;
  }
};

const usage = () => {
  const lines = ["usage: light-native <command> [args]", ""];
  for (const [name, help] of Object.entries(COMMANDS)) lines.push("  " + name.padEnd(10) + " " + help);
  return lines.join("\n");
};

/**
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
export const main = async (argv) => {
  const [name, ...args] = argv;
  if (name === undefined || name === "-h" || name === "--help") {
    console.log(usage());
    return name === undefined ? 1 : 0;
  }
  if (!Object.hasOwn(COMMANDS, name)) {
    console.error("light-native: no such command: " + name + "\n\n" + usage());
    return 1;
  }
  const root = workspaceRoot();
  /** @type {{ run: (args: string[], root: string) => Promise<number> }} */
  const command = await import("./commands/" + name + ".js");
  try {
    return await command.run(args, root);
  } catch (error) {
    console.error("light-native " + name + ": " + (error instanceof Error ? error.message : String(error)));
    return 1;
  }
};
