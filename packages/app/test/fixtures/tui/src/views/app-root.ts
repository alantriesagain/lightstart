/**
 * @file The fixture's root view: the notes as `<note-row>`s and the key that
 * adds one.
 */
import { View, html, key } from "@lightstart/light/native/tui";
import notes from "../controllers/notes.ts";
import "./note-row.ts";

import type { KeyEvent, Renderer } from "@lightstart/light/native/tui";

export default class AppRoot extends View {
  override render(): unknown {
    const rows = notes.rows.value;
    return html`<div class="flex-1 border">
      <p class="font-bold">Notes</p>
      <div class="flex-1 overflow-y-auto">${rows.length === 0 ? html`<p class="text-muted">No notes yet.</p>` : rows.map((row) => key(String(row.id), html`<note-row .note=${row}></note-row>`))}</div>
      <p class="text-muted">a adds a note.</p>
    </div>`;
  }

  onKey(_renderer: Renderer, e: KeyEvent): boolean {
    if (!e.typed("a")) return false;
    notes.add(`note ${String(notes.rows.value.length + 1)}`);
    return true;
  }
}
