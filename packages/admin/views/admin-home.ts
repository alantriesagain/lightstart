/**
 * @file `<admin-home>`: the admin's landing page, the sections as cards, or a
 * one-line empty state when no tool fills one.
 */

import View from "@lightstart/light";
import { html, nothing } from "@lightstart/light/html";
import { adminSections } from "../slots.ts";

class AdminHome extends View {
  render() {
    const sections = adminSections.items.value;
    if (sections.length === 0) return html`<lc-text muted>No tools yet: an extension fills admin.sections to add one.</lc-text>`;
    return html`
      <lc-grid minColumnWidth="220px">
        ${sections.map((section) => html`
          <lc-card href=${section.path} icon=${section.icon} heading=${section.title}>
            <lc-text muted size="sm">Open ${section.title}</lc-text>
            ${nothing}
          </lc-card>
        `)}
      </lc-grid>
    `;
  }
}

View.register("admin-home", AdminHome);
