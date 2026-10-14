/** The demo's contract: what the page may call, and what the backend emits. */
export interface DemoApi {
  add(a: number, b: number): number;
  ping(): string;
  quit(): void;
}

/** What the backend emits. */
export interface DemoEvents {
  tick: number;
  /** Pushed once on connect with `emitJson`, as JSON text. */
  records: { name: string; n: number }[];
}

/** What the page emits. */
export interface DemoPageEvents {
  hello: string;
}
