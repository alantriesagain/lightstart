/**
 * @file The console logger: levels in order, a tag per line, `NO_COLOR` honoured, and the
 * `<PREFIX>_LOG_LEVEL` environment variable read before the flags.
 */
import type { LogLevel, Logger } from "./types/context.ts";

const ORDER: Record<LogLevel, number> = { debug: 0, log: 1, warn: 2, error: 3, silent: 4 };

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

const supportsColor = !!process.stdout.isTTY && process.env.NO_COLOR == null;

const color = (c: keyof typeof COLORS, s: string): string => (supportsColor ? `${COLORS[c]}${s}${COLORS.reset}` : s);

const isLevel = (value: string | undefined): value is LogLevel => value !== undefined && value in ORDER;

/** The level to log at: `<envPrefix>_LOG_LEVEL` first, then what the flags asked for, then `log`. */
export const resolveLevel = (requested?: LogLevel, envPrefix = "LIGHT"): LogLevel => {
  const env = process.env[`${envPrefix}_LOG_LEVEL`]?.toLowerCase();
  if (isLevel(env)) return env;
  return requested ?? "log";
};

/** Where a logger writes; the console by default, a test's own lines when one is passed. */
export type LogWriter = {
  line: (message: string) => void;
  warnLine: (message: string) => void;
  errorLine: (message: string) => void;
};

const CONSOLE: LogWriter = {
  line: (message: string): void => {
    console.log(message);
  },
  warnLine: (message: string): void => {
    console.warn(message);
  },
  errorLine: (message: string): void => {
    console.error(message);
  },
};

/** A logger filtered at `level`, every line tagged with `[prefix]` when one is given. */
export const createLogger = (prefix?: string, level: LogLevel = resolveLevel(), writer: LogWriter = CONSOLE): Logger => {
  const tag = prefix ? color("dim", `[${prefix}] `) : "";
  const allow = (l: LogLevel): boolean => ORDER[l] >= ORDER[level];
  return {
    log: (...args): void => {
      if (allow("log")) writer.line(tag + args.join(" "));
    },
    debug: (...args): void => {
      if (allow("debug")) writer.line(tag + color("dim", args.join(" ")));
    },
    warn: (...args): void => {
      if (allow("warn")) writer.warnLine(tag + color("yellow", args.join(" ")));
    },
    error: (...args): void => {
      if (allow("error")) writer.errorLine(tag + color("red", args.join(" ")));
    },
  };
};
