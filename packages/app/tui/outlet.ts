/**
 * @file The terminal's `<app-outlet>`: a view drawing the view tag the routes
 * answer (`currentView`), the same element while the tag stays. Importing it
 * defines the tag, once; the terminal host and its test mount both do.
 */

import { View, createElement, define, html } from "@lightstart/light/native/tui";
import type { TElement } from "@lightstart/light/native/tui";
import { currentView } from "../run.ts";

/** The view the routes answer, drawn as its tag's element. */
export class AppOutlet extends View {
  private tag = "";
  private element: TElement | null = null;

  override render(): unknown {
    const tag = currentView.value;
    if (tag === null) return html``;
    if (tag !== this.tag || this.element === null) {
      this.tag = tag;
      this.element = createElement(tag);
    }
    return html`${this.element}`;
  }
}

define("app-outlet", AppOutlet);
