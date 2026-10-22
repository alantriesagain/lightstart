/**
 * @file A plugin's process: its lines arrive in a batch, its exit is said once, and a command that
 * cannot run ends the handle instead of leaving it alive.
 */
import { PluginProcess } from "../process.ts";
import { done, eq, ok } from "@light/test/assert.ts";

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const main = async (): Promise<void> => {
  const p = new PluginProcess(1, "test");
  const lines: string[] = [];
  let exit = -2;
  p.onLines = (batch) => {
    for (const line of batch) lines.push(line);
  };
  p.onExit = (code) => {
    exit = code;
  };
  eq("it starts", p.start(["sh", "-c", "printf 'one\\ntwo\\n'; exit 3"], ""), "");
  for (let i = 0; i < 100 && exit === -2; i++) await wait(20);
  eq("its lines", lines.join("|"), "one|two");
  eq("its exit", String(exit), "3");
  ok("and it is not alive", !p.alive);

  const missing = new PluginProcess(2, "test");
  let missingExit = -2;
  let error = "";
  missing.onExit = (code) => {
    missingExit = code;
  };
  missing.onError = (text) => {
    error = text;
  };
  eq("a missing command starts env", missing.start(["native-no-such-command"], ""), "");
  for (let i = 0; i < 100 && missingExit === -2; i++) await wait(20);
  ok("the failed command ends, with its error", !missing.alive && missingExit !== -2 && error.length > 0);
  done();
};

main().catch((err: unknown) => {
  console.log("FAIL " + (err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
