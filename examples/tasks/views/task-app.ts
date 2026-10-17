/**
 * @file The task app on the terminal: the boards side by side, each a
 * `<tasks-board>` with its tasks and a footer line slotted under them, all
 * styled by the theme's utility classes on the terminal; the
 * editor, whose line is a task for the focused board or a command
 * (`/board`, `/rename`, `/delete`); and the footer with the filter, the
 * counts and the keys. Rows and boards ask for their changes with events
 * the app hands to the controller. Outside the editor the arrows move the
 * focus along a board's tasks and across boards, Esc brings it back to the
 * editor, `[` and `]` move the focused board, `f` cycles the filter and `c`
 * clears the done tasks: `appKey` takes those before any element sees them,
 * so they work with nothing focused too.
 */
import { CustomEvent, KeyEvent, Renderer, SubmitEvent, TBox, TElement, TInput, View, focusables, html, key } from "@bootstrapp/light/native";
import board from "../controllers/board.js";
import { TasksBoard } from "./tasks-board.ts";

import type { Board, Task } from "../models/types.ts";

const typed = (e: KeyEvent, text: string) => e.key === "char" && e.text === text && !e.ctrl && !e.alt;
const taskOf = (e: CustomEvent) => e.detail as Task;
const boardOf = (e: CustomEvent) => e.detail as Board | null;

/** The editor under `node`. */
const inputIn = (node: TElement): TInput | null => {
  for (let c = node.firstChild; c !== null; c = c.next) {
    if (c instanceof TInput) return c;
    if (!(c instanceof TElement)) continue;
    const found = inputIn(c);
    if (found !== null) return found;
  }
  return null;
};

/** The element under `node` marked `id="boards"`, the row of boards. */
const boardsRow = (node: TElement): TElement | null => {
  if (node.attrs.get("id") === "boards") return node;
  for (let c = node.firstChild; c !== null; c = c.next) {
    if (!(c instanceof TElement)) continue;
    const found = boardsRow(c);
    if (found !== null) return found;
  }
  return null;
};

export class TaskApp extends View {
  constructor() {
    super();
    this.box.flex = 1;
  }

  /** The boards' views, in the order shown. */
  columns(): TasksBoard[] {
    const out: TasksBoard[] = [];
    const row = boardsRow(this.box);
    if (row === null) return out;
    for (let c = row.firstChild; c !== null; c = c.next) {
      const owner = c instanceof TBox ? c.owner : null;
      if (owner instanceof TasksBoard) out.push(owner);
    }
    return out;
  }

  /** Give the focus back to the editor. */
  focusEditor(renderer: Renderer) {
    const input = inputIn(this.box);
    if (input !== null) renderer.setFocus(input);
  }

  /** Give the focus to the first focusable of the board `delta` away from the focused one. */
  focusBoard(renderer: Renderer, delta: number) {
    const columns = this.columns();
    let at = -1;
    for (let i = 0; i < columns.length; i++) {
      const b = columns[i].board.value;
      if (b !== null && String(b.id) === board.current) at = i;
    }
    const to = at + delta;
    if (at < 0 || to < 0 || to >= columns.length) return;
    const first = focusables(columns[to].box, [])[0];
    if (first !== undefined) renderer.setFocus(first);
  }

  override render(): unknown {
    const { rows, boards, filter, current, open, done } = board;
    const empty = filter === "all" ? "No tasks yet: type one below and press Enter." : `No ${filter} tasks.`;
    const rowsOf = (b: Board) => rows.filter((task) => String(task.boardId) === String(b.id));
    const count = (n: number) => (filter === "all" ? String(n) + (n === 1 ? " task" : " tasks") : String(n) + " " + filter);
    return html`<div class="flex-1">
      <div class="flex-1 flex-row" id="boards">${boards.map((b) => {
        const own = rowsOf(b);
        return key(String(b.id), html`<tasks-board class="flex-1" .board=${b} .tasks=${own} empty=${empty} ?active=${String(b.id) === current}
          @focus-board=${(e: CustomEvent) => {
            const focused = boardOf(e);
            if (focused !== null) board.focusBoard(String(focused.id));
          }}
          @toggle=${(e: CustomEvent) => board.toggle(taskOf(e).id, taskOf(e).done)}
          @remove=${(e: CustomEvent) => board.remove(taskOf(e).id)}
          @move-left=${(e: CustomEvent) => board.moveTask(taskOf(e).id, -1)}
          @move-right=${(e: CustomEvent) => board.moveTask(taskOf(e).id, 1)}><p class="text-muted bg-surface">${count(own.length)}</p></tasks-board>`);
      })}</div>
      <textarea autofocus placeholder="a task for the focused board, Enter adds it; /board Name adds a board" @submit=${(e: SubmitEvent) => board.command(e.value)}></textarea>
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
  else if (typed(e, "[")) board.moveBoard(-1);
  else if (typed(e, "]")) board.moveBoard(1);
  else if (typed(e, "f")) board.nextFilter();
  else if (typed(e, "c")) board.clearDone();
  else return false;
  return true;
};
