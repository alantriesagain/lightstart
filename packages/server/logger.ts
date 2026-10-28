/**
 * @file Where the server's own complaints go: a handler's unexpected error, work after a reply that
 * failed, a reply that could not be written. The default writes to stderr with the stack; a host
 * replaces it with `app.logTo(logger)` to ship them elsewhere, a test to read them back.
 */
export class Logger {
  /** One problem: what failed, then the error itself. */
  error(what: string, error: unknown): void {
    console.error("[server] " + what + ": " + (error instanceof Error ? (error.stack ?? error.message) : String(error)));
  }
}

/** Keeps every problem as "what: message", for a test to read. */
export class MemoryLogger extends Logger {
  readonly lines: string[] = [];

  override error(what: string, error: unknown): void {
    this.lines.push(what + ": " + (error instanceof Error ? error.message : String(error)));
  }
}
