import { nothing } from "./constants.ts";

export type TemplateKind = 1 | 2;

export type NothingValue = typeof nothing;

/** A node of whichever host is installed; only the host reads it. */
export type HostNode = unknown;

type Global = typeof globalThis;

/** The prototype of the global class `Name` where the host's lib declares it, unknown elsewhere. */
type Prototype<Name extends string> = Global extends Record<Name, { prototype: infer P }> ? P : unknown;

/** The members of the global class `Name` that `Keys` names, where the host's lib declares it; nothing elsewhere. */
type Members<Name extends string, Keys extends string> = Prototype<Name> extends infer P ? (unknown extends P ? unknown : Pick<P, Keys & keyof P>) : never;

/** The browser's Element where the DOM lib is present, unknown elsewhere. */
export type HostElement = Prototype<"Element">;

/** The browser's EventTarget where present, unknown elsewhere. */
export type HostEventTarget = Prototype<"EventTarget">;

/** The browser's Event where present, unknown elsewhere. */
export type HostEvent = Prototype<"Event">;

/**
 * An event target read through a template handler: an element with a form
 * control's state and methods, since the control a binding sits on is not
 * knowable from the template. Any other member reads as unknown and is
 * narrowed before use.
 */
export type HandlerTarget = HostEventTarget &
  HostElement &
  Members<"HTMLInputElement", "value" | "checked" | "disabled" | "name" | "files" | "blur" | "focus" | "select"> &
  Record<string, unknown>;

/**
 * The event a template handler receives: an Event whose `target` and
 * `currentTarget` are present, with the key, pointer, drag and input fields
 * the common DOM events carry; any other member reads as unknown. The
 * concrete DOM event type is not knowable from the template, so a handler
 * that needs it annotates its own parameter.
 */
export type HandlerEvent = HostEvent &
  { target: HandlerTarget; currentTarget: HandlerTarget } &
  Members<"KeyboardEvent", "key" | "code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "repeat" | "isComposing"> &
  Members<"PointerEvent", "button" | "buttons" | "clientX" | "clientY" | "offsetX" | "offsetY" | "pointerId" | "pointerType"> &
  Members<"DragEvent", "dataTransfer"> &
  Members<"InputEvent", "data" | "inputType"> &
  Record<string, unknown>;

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

export type { ChildState, ElementState } from "./states.ts";

export * from "./core.ts";
