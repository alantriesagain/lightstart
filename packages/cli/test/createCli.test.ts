/**
 * @file `createCli`: the version, the help, a command, and the global flags split out of an argv.
 * Runs under node and natively; the outputs must be identical.
 */
import { createCli, defineCommand, splitGlobals } from "../index.ts";
import type { ArgsSchema, Command } from "../index.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

eq(
  "the level, help and version flags come out of the argv",
  JSON.stringify(splitGlobals(["build", "--profile", "x", "--quiet", "--help"])),
  '{"level":"error","help":true,"version":false,"argv":["build","--profile","x"]}',
);
eq("a verbose flag asks for debug", JSON.stringify(splitGlobals(["--verbose", "serve"])), '{"level":"debug","help":false,"version":false,"argv":["serve"]}');
eq("a short version flag", JSON.stringify(splitGlobals(["-v"])), '{"help":false,"version":true,"argv":[]}');
eq("everything after -- belongs to the command", JSON.stringify(splitGlobals(["run", "--", "--quiet", "--help"])), '{"help":false,"version":false,"argv":["run","--","--quiet","--help"]}');

const commands: Record<string, Command<ArgsSchema>> = {
  hello: defineCommand({
    description: "Says hello",
    run() {
      return 7;
    },
  }),
};

const cli = createCli({ name: "probe", version: "1.2.3", scopes: [], envPrefix: "PROBE", commands });
const previous = process.env.PROBE_PROJECT_DIR;
process.env.PROBE_PROJECT_DIR = "/tmp/cli-create-none";
const lines: string[] = [];
const out = (text: string): void => {
  lines.push(text);
};

try {
  eqn("--version answers 0", await cli.main(["--version"], out), 0);
  eq("--version prints the configured version", lines[0] ?? "", "1.2.3");
  eqn("--help answers 0", await cli.main(["--help"], out), 0);
  ok("the help names the CLI", (lines[1] ?? "").includes("probe CLI"));
  ok("the help lists a static command", (lines[1] ?? "").includes("hello"));
  eqn("a command answers its code", await cli.main(["hello"], out), 7);
  eqn("a command's own --help is its help", await cli.main(["hello", "--help"], out), 0);
  ok("a command's help names it", (lines[2] ?? "").includes("hello"));
} finally {
  process.env.PROBE_PROJECT_DIR = `${previous ?? ""}`;
}

done();
