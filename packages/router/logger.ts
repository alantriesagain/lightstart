/**
 * @file Where the router's own complaints go: a route or a named route not found, a missing param,
 * a duplicate name, a subscriber that threw. The default writes to the console; a host replaces it
 * with `router.logTo(logger)` to ship them elsewhere, a test with a `MemoryLogger` to read them back.
 */
export class Logger {
  /** Something the router recovered from. */
  warn(message: string): void {
    console.warn("[router] " + message);
  }

  /** Something that failed, with what was thrown when there was one. */
  error(message: string, error?: unknown): void {
    if (error === undefined) console.error("[router] " + message);
    else console.error("[router] " + message + ": " + (error instanceof Error ? (error.stack ?? error.message) : String(error)));
  }
}

/** Keeps every complaint as "warn: message" or "error: message[: what was thrown]", for a test to read. */
export class MemoryLogger extends Logger {
  readonly lines: string[] = [];

  override warn(message: string): void {
    this.lines.push("warn: " + message);
  }

  override error(message: string, error?: unknown): void {
    if (error === undefined) this.lines.push("error: " + message);
    else this.lines.push("error: " + message + ": " + (error instanceof Error ? error.message : String(error)));
  }
}
