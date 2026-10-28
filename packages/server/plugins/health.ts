/**
 * @file A health route for a load balancer or an orchestrator: GET (and HEAD) `/health` by default,
 * answering `{ "ok": true }`, or `{ "ok": false }` with a 503 when the check given says the server
 * cannot serve (its database is gone, it is draining). Never cached.
 */
import type { App } from "../app.ts";
import { Plugin } from "../plugin.ts";
import { Reply, json } from "../reply.ts";

export interface HealthOptions {
  path?: string;
  /** Whether the server can serve; healthy whenever it answers by default. */
  check?: () => Promise<boolean>;
}

export class Health extends Plugin {
  readonly options: HealthOptions;

  constructor(options: HealthOptions = {}) {
    super("health", []);
    this.options = options;
  }

  setup(app: App): void {
    const check = this.options.check;
    app.get(this.options.path ?? "/health", async (): Promise<Reply> => {
      const ok = check === undefined ? true : await check().catch(() => false);
      return json({ ok }, ok ? 200 : 503).header("cache-control", "no-store");
    });
  }
}
