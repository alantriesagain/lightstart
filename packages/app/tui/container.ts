/**
 * @file The terminal's `<app-container>`: a view drawing the view tag the routes
 * answer (`currentView`), the same element while the tag stays. Importing it
 * defines the tag, once; the terminal host and its test mount both do.
 */

import { View, createElement, define, html } from "@lightstart/light/native/tui";
import type { TElement } from "@lightstart/light/native/tui";
import { currentParams, currentView } from "../run.ts";

/** The view the routes answer, drawn as its tag's element, its path's parameters set on it as props. */
export class AppContainer extends View {
  private tag = "";
  private element: TElement | null = null;

  override render(): unknown {
    const tag = currentView.value;
    const params = currentParams.value;
    if (tag === null) return html``;
    if (tag !== this.tag || this.element === null) {
      this.tag = tag;
      this.element = createElement(tag);
    }
    for (const [key, value] of Object.entries(params)) this.element.setProp(key, value);
    return html`${this.element}`;
  }
}

define("app-container", AppContainer);
