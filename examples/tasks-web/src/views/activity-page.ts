/**
 * @file `<activity-page>`, the `/activity` route: what this page did, newest first, from the
 * `activity` store, which is memory and empties when the page closes.
 */
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import card from "@lightstart/components/layout/card.js";
import activity from "../controllers/activity.ts";

View.define(card);

class ActivityPage extends View {
  render() {
    const rows = activity.rows.value;
    return html`
      <lc-card padding="lg">
        ${rows.length === 0 ? html`<p class="muted">Nothing done yet on this page.</p>` : html`<ul class="activity">${rows.map((row) => html`<li>${String(row.text)}</li>`)}</ul>`}
      </lc-card>
    `;
  }
}

View.register("activity-page", ActivityPage);
