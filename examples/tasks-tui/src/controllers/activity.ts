/**
 * @file The activity controller: what this run did, newest first, and `note` for the others to
 * say it. It imports no controller, so it starts first.
 */
import { Controller } from "@lightstart/light/controller/class";
import { LiveRows, modelQuery } from "@lightstart/light/model/binder";
import event from "../models/event.ts";

import type { Event } from "../models/event.ts";

class Activity extends Controller {
  readonly rows = new LiveRows<Event>();

  constructor() {
    super("activity");
  }

  override connected(): Promise<void> | null {
    this.rows.use(modelQuery<Record<string, unknown>>(event, { order: "-at" }));
    return this.rows.loaded();
  }

  override disconnected(): Promise<void> | null {
    this.rows.dispose();
    return null;
  }

  /** Say what happened. */
  async note(text: string): Promise<void> {
    await event.add({ text, at: Date.now() });
  }
}

export default new Activity();
