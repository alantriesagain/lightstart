/**
 * @file `<activity-page>`, the `/activity` route: what this run did, newest first, from the
 * `activity` store, which is memory and empties when the app ends.
 */
import { View, define, html, key } from "@lightstart/light/native/tui";
import activity from "../controllers/activity.ts";

class ActivityPage extends View {
  constructor() {
    super();
    this.box.flex = 1;
  }

  override render(): unknown {
    const rows = activity.rows.value;
    return html`<div class="flex-1 overflow-y-auto">${rows.length > 0 ? rows.map((row) => key(String(row.id), html`<p>${String(row.text)}</p>`)) : html`<p class="text-muted">Nothing done yet in this run.</p>`}</div>`;
  }
}

define("activity-page", ActivityPage);
