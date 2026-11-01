/**
 * @file Refusing cross-origin unsafe requests before routing:
 * `app.plugin(new SameOrigin({ methods: ["POST"] }))`. A request whose method is in the set (POST,
 * PUT, PATCH and DELETE by default), or a websocket upgrade, is answered 403 unless
 * `Context.sameOrigin()` says it came from this origin or from no browser. A safe method and a
 * plain GET pass without a look at the headers.
 */
import type { App } from "../app.ts";
import { Context } from "../context.ts";
import { Plugin } from "../plugin.ts";
import { Reply, fail } from "../reply.ts";

export interface SameOriginOptions {
  /** The methods refused when cross-origin; POST, PUT, PATCH and DELETE by default. */
  methods?: string[];
  /** Whether websocket upgrades are checked too; true by default. */
  upgrades?: boolean;
}

const DEFAULT_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

export class SameOrigin extends Plugin {
  readonly options: SameOriginOptions;

  constructor(options: SameOriginOptions = {}) {
    super("same-origin", []);
    this.options = options;
  }

  setup(app: App): void {
    const methods: string[] = [];
    for (const method of this.options.methods ?? DEFAULT_METHODS) methods.push(method.toUpperCase());
    const upgrades = this.options.upgrades !== false;
    app.onRequest((c: Context): Reply | null => {
      const upgrade = c.header("upgrade");
      const isUpgrade = upgrade !== null && upgrade !== "";
      if (!(upgrades && isUpgrade) && methods.indexOf(c.method) < 0) return null;
      if (c.sameOrigin()) return null;
      return fail("cross-origin request refused", 403);
    });
  }
}
