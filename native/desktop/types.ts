/**
 * @bootstrapp/light/native/desktop: the types of the bridge. An app declares one contract (its
 * methods) and one events map, and both the page and the backend import them: the page's `call`
 * is the contract with every method returning a Promise, the backend's handlers receive the
 * arguments as `unknown[]` and narrow them, since a native build checks nothing it did not parse.
 */

/** The backend's methods: an interface whose members are functions. */
export type Contract = object;

/** The contract as the page sees it: every method, called with its arguments, answers a Promise of its result. */
export type Client<C extends Contract> = {
  [K in keyof C]: C[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never;
};

/** Events in one direction, backend to page or page to backend: an interface from event name to the value it carries. */
export type Events = object;

/** Register a listener; answers the function that removes it. */
export type Listen<E extends Events> = <K extends keyof E & string>(name: K, fn: (value: E[K]) => void) => () => void;

export type Unlisten<E extends Events> = <K extends keyof E & string>(name: K, fn: (value: E[K]) => void) => void;

export type Emit<E extends Events> = <K extends keyof E & string>(name: K, value: E[K]) => void;

/**
 * What `connect()` answers in the page: `C` the backend's methods, `E` the events it emits,
 * `P` the events the page emits to it.
 */
export interface Desktop<C extends Contract, E extends Events, P extends Events = Events> {
  call: Client<C>;
  on: Listen<E>;
  /** Like `on`, for the next event only. */
  once: Listen<E>;
  off: Unlisten<E>;
  /** Send an event to the backend's `on(name, …)` listeners; resolves once it was delivered. */
  emit<K extends keyof P & string>(name: K, value: P[K]): Promise<void>;
  /** Write to the backend's log; the page's own console is not visible. */
  log(level: string, text: string): Promise<void>;
  /** Tell the backend the page is up; resolves once it answered. */
  ready(): Promise<void>;
}

/** A backend handler: the page's arguments, parsed from JSON, and the value to answer. */
export type Handler = (args: unknown[]) => Promise<unknown>;

export interface DesktopWindowOptions {
  title?: string;
  width?: number;
  height?: number;
  /**
   * Open without the system title bar, for a page that draws its own (light's `lc-title-bar`):
   * on Linux the window keeps its resize borders and shadow, on macOS the system's traffic lights
   * stay over a transparent bar, on Windows the native caption stays.
   */
  frameless?: boolean;
  /** Open the engine's developer tools. */
  debug?: boolean;
  /** Milliseconds between two steps of the platform loop. */
  pumpMs?: number;
}

export interface DesktopOptions extends DesktopWindowOptions {
  /** The directory holding index.html and the page's files; by default `web` beside the executable. */
  web?: string;
}

export { DesktopApp, Listener, Route, arr, bool, num, str } from "./host.js";
export { DesktopWindow } from "./window.js";
export { connect } from "./client.js";
