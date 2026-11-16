/**
 * @file `<note-row .note=${note}>`: one note as a line, muted while it has no
 * focus and bold while it does.
 */
import { View, define, html } from "@lightstart/light/native/tui";

import type { Note } from "../models/note.ts";

class NoteRow extends View {
  note = this.prop<Note | null>("note", null);

  override render(): unknown {
    const shown = this.note.value;
    if (shown === null) return null;
    return html`<p class="text-muted focus:font-bold">${String(shown.text)}</p>`;
  }
}

define("note-row", NoteRow);
