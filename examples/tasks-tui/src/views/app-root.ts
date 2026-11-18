/**
 * @file The root view: the open list's name, the pages the keys go to, and `<app-container>`, which
 * draws the page the path answers (src/routes.ts). F1, F2 and F3 go to the tasks, the lists and
 * the activity; Ctrl+C quits.
 */
import { html, View } from "@lightstart/light/native/tui";
import { navigate } from "@lightstart/app/tui";
import lists from "../controllers/lists.ts";
import "./tasks-page.ts";
import "./lists-page.ts";
import "./activity-page.ts";

import type { KeyEvent, Renderer } from "@lightstart/light/native/tui";

const PAGES: [string, string][] = [
  ["f1", "/"],
  ["f2", "/lists"],
  ["f3", "/activity"],
];

export default class AppRoot extends View {
  constructor() {
    super();
    this.box.flex = 1;
  }

  override render(): unknown {
    const open = lists.currentList();
    return html`<div class="flex-1 border">
      <p><span class="font-bold">Tasks</span> <span class="text-muted">· ${open !== null ? String(open.name) : ""}</span></p>
      <app-container class="flex-1"></app-container>
      <p class="text-muted">F1 tasks · F2 lists · F3 activity · Ctrl+C quits</p>
    </div>`;
  }

  onKey(_renderer: Renderer, e: KeyEvent): boolean {
    const page = PAGES.find(([key]) => key === e.key);
    if (page === undefined) return false;
    navigate(page[1]);
    return true;
  }
}
