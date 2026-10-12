import { nothing } from "./constants.js";

export type TemplateKind = 1 | 2;

export type NothingValue = typeof nothing;

/** An event target read through a template handler: the element's members are open. */
export type HandlerTarget = EventTarget & Record<string, any>;

/**
 * The event a template handler receives: an Event whose `target` and
 * `currentTarget` are present with open members, plus an open index
 * signature on the event itself. The concrete DOM event type is not
 * knowable from the template, so a handler that needs it annotates its
 * own parameter.
 */
export type HandlerEvent = Event & { target: HandlerTarget; currentTarget: HandlerTarget } & Record<string, any>;

/** Method-style so the parameter compares bivariantly: a handler may declare the concrete DOM event its binding delivers. */
interface HandlerSignature {
  handle(event: HandlerEvent): unknown;
}

/**
 * A function placed in a template is typed as a handler.
 * `@click=${(e) => e.preventDefault()}` sees the event's members,
 * `e.target.value` reads without a cast, a `.prop=${(info) => ...}`
 * callback receiving another shape still reads its fields, and a handler
 * that annotates its parameter with the concrete DOM event keeps that type.
 */
export type TemplateHandler = HandlerSignature["handle"];

/** Anything a template renders as a child. Every JS value except a bare `unknown` fits, so this is what a render helper returns. */
export type Renderable = string | number | boolean | bigint | symbol | null | undefined | object;

/** What a template value may be; only functions are narrowed, the rest is left open. */
export type TemplateValue = Renderable | TemplateHandler;

export type { TemplateResult, ElementSpec, Keyed, Unsafe } from "./values.js";
/** @deprecated use Keyed */
export type KeySpec = import("./values.js").Keyed;
/** @deprecated use Unsafe */
export type UnsafeSpec = import("./values.js").Unsafe;

export type RenderContainer = Element | DocumentFragment;

export interface RenderOptions {
  host?: object;
  adopt?: boolean | "bind";
  /** Resolves when the app is idle; until then an adopting part holds a value its served range cannot adopt. */
  settle?: () => Promise<unknown>;
}

export interface EffectHandle {
  dispose(): void;
}

export type EffectAdapter = (fn: () => void) => EffectHandle;

export interface ThunkHolder {
  start?: Node | null;
  el?: Element;
  _thunk: (() => unknown) | undefined;
  _effect: EffectHandle | null;
  _thunkLive: boolean;
}

export type PartKind = "child" | "attr" | "prop" | "bool" | "event" | "rawtext" | "slot";

/**
 * An element whose templates project its light children into the `<slot>`
 * elements they render: it registers every slot part cloned under it and
 * runs projection once the clone is in the tree.
 */
export interface SlotHost extends Element {
  /** Null on a host that renders into a shadow root, where the browser projects. */
  $slotParts: Set<import("./slots.js").SlotPart> | null;
  $root: { start: Comment; end: Comment } | null;
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

export interface ParsedPart {
  kind: PartKind;
  valueIndex: number;
  valueCount: number;
  name?: string;
  statics?: string[];
  elOrd?: number;
  childOrd?: number;
}

export interface PartSpec extends ParsedPart {
  nodeIndex: number;
}

export interface ParseResult {
  markup: string;
  parts: ParsedPart[];
}

export type ElementBindings = Record<string, unknown> & {
  ref?: (el: Element | null) => void;
};

export * from "./index.js";
