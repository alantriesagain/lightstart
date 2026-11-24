// node-only
/**
 * @file `<app-slot>` on the markup host: a root view writing it prerenders
 * the tags its slot holds, each with the slot's context and the item set on
 * it, and an empty slot leaves the placeholder empty.
 */

import "@lightstart/light/markup";
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { done, ok } from "@lightstart/test/assert.ts";
import { defineApp } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { Slot, defineSlot } from "../slots.ts";
import { renderApp, renderPage, type RenderOptions } from "../static/index.ts";

interface SlotItem {
  tag?: unknown;
  order?: number;
  label?: string;
}

const labelOf = (value: unknown): string => {
  if (typeof value !== "object" || value === null) return "";
  const label = Reflect.get(value, "label");
  return typeof label === "string" ? label : "";
};

const noteOf = (value: unknown): string => {
  if (typeof value !== "object" || value === null) return "";
  const note = Reflect.get(value, "note");
  return typeof note === "string" ? note : "";
};

class SlotProbe extends View.props({ item: T.any({ attribute: false }), context: T.any({ attribute: false }) }) {

  render(): unknown {
    return html`<span>${labelOf(this.item)} ${noteOf(this.context)}</span>`;
  }
}

class SlotProbeA extends SlotProbe {}
class SlotProbeB extends SlotProbe {}

View.register("static-slot-probe-a", SlotProbeA);
View.register("static-slot-probe-b", SlotProbeB);

const holder: { slot: Slot<object> | null; context: object | null } = { slot: null, context: null };

class SlotRoot extends View {
  render(): unknown {
    return html`<app-slot .slot=${holder.slot} .context=${holder.context}></app-slot>`;
  }
}

View.register("static-slot-test-root", SlotRoot);

const manifest: AppManifest = {
  app: defineApp({ name: "slot-static", host: "@lightstart/app/static", root: "static-slot-test-root" }),
  models: [],
  controllers: [],
  routes: null,
  views: [],
};

const page = "<!doctype html><html><head><title>Slot</title></head><body><static-slot-test-root></static-slot-test-root></body></html>";

const main = async (): Promise<void> => {
  const options: RenderOptions = {};
  const slot = defineSlot<SlotItem>("static-slot-filled");
  slot.fill({ tag: "static-slot-probe-b", order: 2, label: "second" });
  slot.fill({ tag: "static-slot-probe-a", order: 1, label: "first" });
  holder.slot = slot;
  holder.context = { note: "context" };

  const markup = await renderApp(manifest, options);
  const firstAt = markup.indexOf("<static-slot-probe-a");
  const secondAt = markup.indexOf("<static-slot-probe-b");
  ok("the slot draws an element for each item's tag", firstAt >= 0 && secondAt >= 0);
  ok("the items are drawn in the slot's order", firstAt < secondAt);
  const text = markup.replace(/<!--[^>]*-->/g, "");
  ok("each item element carries its item and the slot's context", text.includes("first context") && text.includes("second context"));
  ok("the filled tags sit under <app-slot>", /<app-slot[^>]*>[\s\S]*<static-slot-probe-a[\s\S]*<static-slot-probe-b[\s\S]*<\/app-slot>/.test(markup));

  const rendered = await renderPage(manifest, page, options);
  ok("a prerendered page holds the filled tags", rendered.includes("<static-slot-probe-a") && rendered.includes("<static-slot-probe-b"));
  ok("the page keeps the prerender marker", rendered.includes("window.__PRERENDERED__ = true"));

  const empty = defineSlot<SlotItem>("static-slot-empty");
  holder.slot = empty;
  const blank = await renderApp(manifest, options);
  ok("an empty slot draws no item tags", !blank.includes("<static-slot-probe-a") && !blank.includes("<static-slot-probe-b"));
  done();
};

await main();
