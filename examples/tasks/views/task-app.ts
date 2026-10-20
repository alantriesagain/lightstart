/**
 * @file The task app on the terminal: the boards side by side, each a
 * `<tasks-board>` with its tasks and a footer line slotted under them, all
 * styled by the theme's utility classes on the terminal; the
 * editor, whose line is a task for the focused board or a command
 * (`/board`, `/rename`, `/delete`); and the footer with the filter, the
 * counts and the keys. The rows and the boards call the controller for
 * their own changes. Outside the editor the arrows move the focus along a
 * board's tasks and across boards, Esc brings it back to the editor, `[`
 * and `]` move the focused board, `f` cycles the filter and `c` clears the
 * done tasks: `appKey` takes those before any element sees them, so they
 * work with nothing focused too.
 */
import { KeyEvent, Renderer, SubmitEvent, TBox, TElement, TInput, View, find, focusables, html, key } from "@bootstrapp/light/native";
import board from "../controllers/board.js";
import { TasksBoard } from "./tasks-board.ts";

import type { Board } from "../models/types.ts";

export class TaskApp extends View {
  /** The editor under the boards, placed by the template. */
  readonly input = new TInput("textarea");

  constructor() {
    super();
    this.box.flex = 1;
    this.input.placeholder = "a task for the focused board, Enter adds it; /board Name adds a board";
    this.input.attrs.set("autofocus", "");
  }

  /** The boards' views, in the order shown. */
  columns(): TasksBoard[] {
    const out: TasksBoard[] = [];
    const row = find(this.box, (el: TElement) => el.attrs.get("id") === "boards");
    if (row === null) return out;
    for (let c = row.firstChild; c !== null; c = c.next) {
      const owner = c instanceof TBox ? c.owner : null;
      if (owner instanceof TasksBoard) out.push(owner);
    }
    return out;
  }

  /** Give the focus back to the editor. */
  focusEditor(renderer: Renderer) {
    renderer.setFocus(this.input);
  }

  /** Give the focus to the first focusable of the board `delta` away from the focused one. */
  focusBoard(renderer: Renderer, delta: number) {
    const columns = this.columns();
    let at = -1;
    for (let i = 0; i < columns.length; i++) {
      const b = columns[i].board.value;
      if (b !== null && b.id === board.current) at = i;
    }
    const to = at + delta;
    if (at < 0 || to < 0 || to >= columns.length) return;
    const first = focusables(columns[to].box, [])[0];
    if (first !== undefined) renderer.setFocus(first);
  }

  override render(): unknown {
    const { rows, boards, filter, current, open, done } = board;
    const empty = filter === "all" ? "No tasks yet: type one below and press Enter." : `No ${filter} tasks.`;
    const rowsOf = (b: Board) => rows.filter((task) => task.boardId === b.id);
    const count = (n: number) => (filter === "all" ? String(n) + (n === 1 ? " task" : " tasks") : String(n) + " " + filter);
    return html`<div class="flex-1" @submit=${(e: SubmitEvent) => board.command(e.value)}>
      <div class="flex-1 flex-row" id="boards">${boards.map((b) => {
        const own = rowsOf(b);
        return key(b.id, html`<tasks-board class="flex-1" .board=${b} .tasks=${own} empty=${empty} ?active=${b.id === current}><p class="text-muted bg-surface">${count(own.length)}</p></tasks-board>`);
      })}</div>
      ${this.input}
      <p class="text-muted">tasks: ${filter}. ${open} open, ${done} done. Tab moves, arrows move across, Esc returns to the editor, Space toggles, d deletes, Shift+arrows move a task, [ ] move a board, f filters, c clears done, Ctrl+C quits.</p>
    </div>`;
  }
}

/** The app's keys outside the editor; answers whether it took the key. */
export const appKey = (renderer: Renderer, app: TaskApp, e: KeyEvent): boolean => {
  const { focus } = renderer;
  if (focus instanceof TInput && focus.isConnected()) return false;
  if (e.key === "up" || e.key === "down") renderer.moveFocus(e.key === "up" ? -1 : 1);
  else if (e.key === "escape") app.focusEditor(renderer);
  else if ((e.key === "left" || e.key === "right") && !e.shift) app.focusBoard(renderer, e.key === "left" ? -1 : 1);
  else if (e.typed("[")) board.moveBoard(-1);
  else if (e.typed("]")) board.moveBoard(1);
  else if (e.typed("f")) board.nextFilter();
  else if (e.typed("c")) board.clearDone();
  else return false;
  return true;
};
