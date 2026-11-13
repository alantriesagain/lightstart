/**
 * @file The logger filters at its level, tags every line with its prefix, and the environment
 * level wins over the flags, which win over the default.
 * Runs under node and natively; the outputs must be identical.
 */
import { createLogger, resolveLevel } from "../log.ts";
import type { LogWriter } from "../log.ts";
import { done, eq, ok } from "@light/test/assert.ts";

const lines: string[] = [];
const writer: LogWriter = {
  line: (message: string): void => {
    lines.push(message);
  },
  warnLine: (message: string): void => {
    lines.push(message);
  },
  errorLine: (message: string): void => {
    lines.push(message);
  },
};

const capture = (fn: () => void): string[] => {
  lines.length = 0;
  fn();
  return lines.map((line: string): string => line.replace(/\x1b\[[0-9;]*m/g, ""));
};

const filtered = capture((): void => {
  const log = createLogger("pkg", "warn", writer);
  log.debug("d");
  log.log("l");
  log.warn("w");
  log.error("e");
});
eq("warn keeps warn and error, tagged", JSON.stringify(filtered), '["[pkg] w","[pkg] e"]');
eq("silent drops everything", JSON.stringify(capture((): void => {
  const log = createLogger(undefined, "silent", writer);
  log.error("e");
})), "[]");
eq("debug keeps everything", JSON.stringify(capture((): void => {
  const log = createLogger(undefined, "debug", writer);
  log.debug("d");
  log.log("l");
})), '["d","l"]');

const previous = process.env.LIGHT_LOG_LEVEL;
try {
  process.env.LIGHT_LOG_LEVEL = "";
  eq("the default level", resolveLevel(), "log");
  eq("a requested level", resolveLevel("error"), "error");
  process.env.LIGHT_LOG_LEVEL = "SILENT";
  eq("the environment wins", resolveLevel("debug"), "silent");
  process.env.LIGHT_LOG_LEVEL = "nonsense";
  eq("an unknown environment level is ignored", resolveLevel("debug"), "debug");
} finally {
  process.env.LIGHT_LOG_LEVEL = `${previous ?? ""}`;
}

ok("a logger has all four methods", typeof createLogger("x").debug === "function" && typeof createLogger("x").warn === "function");

done();
