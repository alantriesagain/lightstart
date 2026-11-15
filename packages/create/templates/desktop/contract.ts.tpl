/**
 * @file The contract between the page and the backend: the methods the page calls, the events
 * the backend emits and the events the page sends back. Both sides import the types only; the
 * backend is compiled by scriptc and the page is JavaScript, so nothing here runs.
 */

/** What the page may call: each member becomes a Promise-returning method in `desktop.call`. */
export interface Api {
  /** Read this machine's platform and home directory. */
  machine(): Machine;
  /** Add two numbers. */
  add(a: number, b: number): number;
  /** Close the window and the program. */
  quit(): void;
}

/** The value `machine` answers. */
export interface Machine {
  platform: string;
  home: string;
}

/** What the backend pushes to the page with `app.emit`. */
export interface Events {
  tick: number;
}

/** What the page sends to the backend with `desktop.emit`. */
export interface PageEvents {
  hello: string;
}
