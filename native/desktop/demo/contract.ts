/** The demo's contract: what the page may call, and what the backend emits. */
export interface DemoApi {
  add(a: number, b: number): number;
  ping(): string;
  quit(): void;
}

export interface DemoEvents {
  tick: number;
}
