/**
 * @file The activity controller: what this run did, newest first, and `note` for the others to
 * say it. It imports no controller, so it starts first.
 */
import { Controller } from "@lightstart/light/controller/class";
import { liveRows } from "@lightstart/light/model/binder";
import { EventRow } from "../../.light/models.ts";
import event from "../models/event.ts";

class Activity extends Controller {
  readonly rows = liveRows<EventRow>(this, event, () => ({ order: "-at" }), EventRow.of);

  constructor() {
    super("activity");
  }

  /** Say what happened. */
  async note(text: string): Promise<void> {
    await event.add({ text, at: Date.now() });
  }
}

export default new Activity();
