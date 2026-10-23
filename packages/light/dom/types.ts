import type { ChildPart } from "../html/parts.ts";

/**
 * An element whose templates project its light children into the `<slot>`
 * elements they render: it registers every slot part cloned under it and
 * runs projection once the clone is in the tree.
 */
export interface SlotHost extends Element {
  /** Null on a host that renders into a shadow root, where the browser projects. */
  $slotParts: Set<import("./slots.js").SlotPart> | null;
  $root: ChildPart | null;
  /** The hidden holder of content no rendered slot takes, present only while it holds something. */
  $unslotted: Element | null;
  $queueProject(): void;
}

/** What a host hands `projectSlots` to be told which nodes to watch and which slot names it lacks. */
export interface ProjectHooks {
  watchSlot(el: Element): void;
  watchUnit(el: Element): void;
  unknown(name: string): void;
}

/** One thing a served host projected, as its parent's walker sees it: a child-part range or an element, with the slot it sits in (null for the light area). */
export type ProjectedUnit =
  | { range: true; start: Comment; end: Comment; slot: string | null; taken: boolean }
  | { range: false; node: Element; slot: string; taken: boolean };

/** Re-export the runtime so `@bootstrapp/light/dom` surfaces the browser View and the host beside these declarations. */
export * from "./index.js";
export { default } from "./index.js";
