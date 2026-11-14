/**
 * @file A request as a route app sees it in dev: every method answered by the request it came
 * from, except `waitUntil`, whose work is kept so the server finishes it before the reply goes
 * out. A dev route's writes are then done by the time its caller hears back, as in a test.
 */
import { Context, Incoming } from "@lightstart/server";

/** The incoming request with the work its handlers handed to `waitUntil` held back. */
export class SettledIncoming extends Incoming {
  readonly work: Promise<void>[] = [];
  private readonly source: Incoming;

  constructor(source: Incoming) {
    super();
    this.source = source;
  }

  method(): string {
    return this.source.method();
  }

  target(): string {
    return this.source.target();
  }

  header(name: string): string | null {
    return this.source.header(name);
  }

  headerPairs(): string[] {
    return this.source.headerPairs();
  }

  text(limit: number): Promise<string> {
    return this.source.text(limit);
  }

  bytes(limit: number): Promise<Uint8Array> {
    return this.source.bytes(limit);
  }

  remoteAddress(): string {
    return this.source.remoteAddress();
  }

  host(): string {
    return this.source.host();
  }

  protocol(): string {
    return this.source.protocol();
  }

  signal(): AbortSignal {
    return this.source.signal();
  }

  abort(reason: string): void {
    this.source.abort(reason);
  }

  waitUntil(work: Promise<void>): void {
    this.work.push(work);
  }
}

/** A context over `c`'s request whose `waitUntil` work is held, and the holder to await. */
export const settledContext = (c: Context): { context: Context; incoming: SettledIncoming } => {
  const incoming = new SettledIncoming(c.incoming);
  const context = new Context(incoming);
  context.limit = c.limit;
  return { context, incoming };
};
