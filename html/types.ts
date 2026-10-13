import { nothing } from "./constants.ts";

export type TemplateKind = 1 | 2;

export type NothingValue = typeof nothing;

/** A node of whichever host is installed; only the host reads it. */
export type HostNode = unknown;

type Global = typeof globalThis;

/** The browser's Element where the DOM lib is present, unknown elsewhere. */
export type HostElement = Global extends { Element: { prototype: infer E } } ? E : unknown;

/** The browser's EventTarget where present, unknown elsewhere. */
export type HostEventTarget = Global extends { EventTarget: { prototype: infer E } } ? E : unknown;

/** The browser's Event where present, unknown elsewhere. */
export type HostEvent = Global extends { Event: { prototype: infer E } } ? E : unknown;

/** An event target read through a template handler: the element's members are open. */
export type HandlerTarget = HostEventTarget & Record<string, any>;

/**
 * The event a template handler receives: an Event whose `target` and
 * `currentTarget` are present with open members, plus an open index
 * signature on the event itself. The concrete DOM event type is not
 * knowable from the template, so a handler that needs it annotates its
 * own parameter.
 */
export type HandlerEvent = HostEvent & { target: HandlerTarget; currentTarget: HandlerTarget } & Record<string, any>;

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

export type { TemplateResult, ElementSpec, Keyed, Unsafe } from "./values.ts";
/** @deprecated use Keyed */
export type KeySpec = import("./values.ts").Keyed;
/** @deprecated use Unsafe */
export type UnsafeSpec = import("./values.ts").Unsafe;

/** Where `render` puts its root part: an element of the installed host. */
export type RenderContainer = unknown;

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

export type { ThunkHolder } from "./reactive.ts";

export type PartKind = "child" | "attr" | "prop" | "bool" | "event" | "rawtext" | "slot";

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
  ref?: (el: HostElement | null) => void;
};

/** The state of a child part rendering an `element()`: the element, what each binding committed, its listeners and its own child part. */
export type ElementState = {
  type: "element";
  tag: string;
  el: HostNode;
  committed: Map<string, unknown>;
  events: Map<string, import("./parts.ts").EventBinding>;
  ref: ((el: HostElement | null) => void) | null;
  childPart: import("./parts.ts").ChildPart | null;
};

/** What a child part currently renders; `pending` is a served range awaiting adoption. */
export type ChildState =
  | { type: "empty" }
  | { type: "pending" }
  | { type: "text"; node: HostNode; text: string }
  | { type: "template"; instance: import("./template.ts").TemplateInstance }
  | { type: "items"; parts: import("./parts.ts").ChildPart[]; keys: unknown[] | null }
  | { type: "keyed"; k: unknown; inner: import("./parts.ts").ChildPart }
  | { type: "node"; node: HostNode }
  | { type: "unsafe"; s: string }
  | ElementState;

export * from "./core.ts";
