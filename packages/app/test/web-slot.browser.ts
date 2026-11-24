/**
 * @file `<app-slot>` on the web host: the items a slot holds drawn by the tag
 * each names, in order, with the slot's context and the item set on every
 * element, a later fill adding one and its withdraw taking it away, and an
 * empty slot drawing nothing.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { openPage } from "@lightstart/app/web/test";
import { defineApp } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { defineSlot } from "../slots.ts";

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

class SlotProbe extends View.props({ item: T.any({ attribute: false }), context: T.any({ attribute: false }) }) {

  render(): unknown {
    return html`<span>${labelOf(this.item)}</span>`;
  }
}

class SlotProbeA extends SlotProbe {}
class SlotProbeB extends SlotProbe {}

View.register("slot-probe-a", SlotProbeA);
View.register("slot-probe-b", SlotProbeB);

class SlotRoot extends View.props({ slot: T.object({ defaultValue: null, attribute: false }), context: T.object({ defaultValue: null, attribute: false }) }) {
  render(): unknown {
    return html`<app-slot .slot=${this.slot} .context=${this.context}></app-slot>`;
  }
}

View.register("slot-test-root", SlotRoot);

const manifest: AppManifest = {
  app: defineApp({ name: "slot-test", host: "@lightstart/app/web", root: "slot-test-root" }),
  models: [],
  controllers: [],
  routes: null,
  views: [],
};

let defined = 0;

const openWith = async (): Promise<{ page: Awaited<ReturnType<typeof openPage>>; root: HTMLElement; slot: ReturnType<typeof defineSlot<SlotItem>> }> => {
  const slot = defineSlot<SlotItem>(`slot-test-${String(++defined)}`);
  const page = await openPage(manifest, { path: "/" });
  const root = await page.find("slot-test-root");
  const control = root as unknown as { slot: unknown; context: unknown };
  control.slot = slot;
  control.context = { note: "context" };
  await page.find("app-slot");
  await page.settle();
  return { page, root, slot };
};

const drawn = (root: HTMLElement): HTMLElement[] => [...root.querySelectorAll<HTMLElement>("slot-probe-a, slot-probe-b")];

describe("<app-slot>", () => {
  it("draws each item by its tag, in order, with the context and the item set", async () => {
    const { page, root, slot } = await openWith();
    try {
      const first = { tag: "slot-probe-b", order: 2, label: "b" };
      const second = { tag: "slot-probe-a", order: 1, label: "a" };
      slot.fill(first);
      slot.fill(second);
      await page.settle();
      const elements = drawn(root);
      assert.deepEqual(elements.map((element) => element.tagName.toLowerCase()), ["slot-probe-a", "slot-probe-b"]);
      const context = (elements[0] as unknown as { context: unknown }).context;
      assert.deepEqual(context, { note: "context" });
      assert.equal((elements[0] as unknown as { context: unknown }).context, (elements[1] as unknown as { context: unknown }).context);
      assert.equal((elements[0] as unknown as { item: unknown }).item, second);
      assert.equal((elements[1] as unknown as { item: unknown }).item, first);
      assert.deepEqual(elements.map((element) => element.textContent), ["a", "b"]);
    } finally {
      await page.stop();
    }
  });

  it("adds an element when the slot is filled later, and takes it away on withdraw", async () => {
    const { page, root, slot } = await openWith();
    try {
      slot.fill({ tag: "slot-probe-a", label: "a" });
      await page.settle();
      assert.equal(drawn(root).length, 1);
      const withdraw = slot.fill({ tag: "slot-probe-b", label: "b" });
      await page.settle();
      assert.equal(drawn(root).length, 2);
      assert.ok(drawn(root).some((element) => element.tagName.toLowerCase() === "slot-probe-b"));
      withdraw();
      await page.settle();
      assert.equal(drawn(root).length, 1);
      assert.equal(root.querySelector("slot-probe-b"), null);
    } finally {
      await page.stop();
    }
  });

  it("draws nothing for an empty slot", async () => {
    const { page, root } = await openWith();
    try {
      assert.equal(root.querySelector("app-slot")?.querySelectorAll("*").length, 0);
      assert.equal(drawn(root).length, 0);
    } finally {
      await page.stop();
    }
  });
});
