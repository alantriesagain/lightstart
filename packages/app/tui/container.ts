/**
 * @file The terminal's `<app-container>`: a view drawing the route's view,
 * wrapped in its layout, the same elements while their tags stay. Importing
 * it defines the tag, once; the terminal host and its test mount both do.
 */

import { View, createElement, define, html } from "@lightstart/light/native/tui";
import type { TElement } from "@lightstart/light/native/tui";

/** A prop value the terminal element takes: the primitives a view declares, an object written as text. */
type PropValue = string | number | boolean | null;

const propValueOf = (value: unknown): PropValue => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) return value;
  return String(value);
};
import { outletAt } from "../run.ts";
import type { OutletPosition } from "../outlet.ts";

interface MadePosition {
  level: number;
  kind: "layout" | "view";
}

/** Every element a container made, and the level it draws: a nested container finds its position from the nearest one above it. */
const madePositions = new WeakMap<TElement, MadePosition>();

const positionOf = (container: AppContainer): OutletPosition => {
  let node: TElement | null = container.box.parent;
  while (node !== null) {
    const made = madePositions.get(node);
    if (made !== undefined) return made.kind === "layout" ? { level: made.level, kind: "layout" } : { level: made.level + 1, kind: "root" };
    node = node.parent;
  }
  return { level: 0, kind: "root" };
};

/** The view the routes answer, wrapped in its layout, its props set as the outlet resolves them. */
export class AppContainer extends View {
  private layoutTag: string | null = null;
  private layoutElement: TElement | null = null;
  private viewTag: string | null = null;
  private viewElement: TElement | null = null;

  override render(): unknown {
    const outlet = outletAt(positionOf(this));
    const view = outlet.view;
    if (view === null) return html``;
    if (outlet.layout !== null) {
      if (outlet.layout !== this.layoutTag || this.layoutElement === null) {
        this.layoutTag = outlet.layout;
        this.layoutElement = createElement(outlet.layout);
        this.viewTag = null;
        this.viewElement = null;
      }
      madePositions.set(this.layoutElement, { level: outlet.level, kind: "layout" });
      return html`${this.layoutElement}`;
    }
    this.layoutTag = null;
    this.layoutElement = null;
    if (view !== this.viewTag || this.viewElement === null) {
      this.viewTag = view;
      this.viewElement = createElement(view);
    }
    madePositions.set(this.viewElement, { level: outlet.level, kind: "view" });
    for (const key of Object.keys(outlet.props)) this.viewElement.setProp(key, propValueOf(outlet.props[key]));
    return html`${this.viewElement}`;
  }
}

define("app-container", AppContainer);
