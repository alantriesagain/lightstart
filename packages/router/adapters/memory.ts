/**
 * @lightstart/router/adapters/memory: a location and a history held in
 * memory, for tests, server rendering and native apps.
 */

import type { AdapterLocation, HistoryEntry, RouterAdapter } from "../contracts.ts";

/** A router adapter that keeps its location and history in fields. */
export class MemoryAdapter implements RouterAdapter {
  readonly type = "memory";
  private readonly origin = "http://memory";
  private pathname: string;
  private search: string;
  private hash: string;
  private readonly history: HistoryEntry[] = [];
  private index = -1;

  constructor(initialPath = "/") {
    const url = new URL(initialPath, this.origin);
    this.pathname = url.pathname;
    this.search = url.search;
    this.hash = url.hash;
  }

  getLocation(): AdapterLocation {
    return {
      href: `${this.origin}${this.pathname}${this.search}${this.hash}`,
      origin: this.origin,
      pathname: this.pathname,
      search: this.search,
      hash: this.hash,
    };
  }

  isSamePath(path: string): boolean {
    const url = new URL(path, this.origin);
    const current = `${this.pathname}${this.search}${this.hash}`;
    const next = `${url.pathname}${url.search}${url.hash}`;
    return current === next;
  }

  hardNavigate(path: string): void {
    this.set(path);
  }

  pushState(state: unknown, path: string): void {
    this.set(path);
    if (this.index < this.history.length - 1) this.history.splice(this.index + 1);
    this.history.push({ pathname: this.pathname, search: this.search, hash: this.hash, state });
    this.index = this.history.length - 1;
  }

  replaceState(state: unknown, path: string): void {
    this.set(path);
    if (this.index >= 0) this.history[this.index] = { pathname: this.pathname, search: this.search, hash: this.hash, state };
  }

  back(): boolean {
    if (this.index <= 0) return false;
    this.index--;
    this.replay();
    return true;
  }

  forward(): boolean {
    if (this.index >= this.history.length - 1) return false;
    this.index++;
    this.replay();
    return true;
  }

  setTitle(_title: string): void {
  }

  getHistory(): { entries: HistoryEntry[]; index: number } {
    return { entries: [...this.history], index: this.index };
  }

  private set(path: string): void {
    const url = new URL(path, this.origin);
    this.pathname = url.pathname;
    this.search = url.search;
    this.hash = url.hash;
  }

  private replay(): void {
    const entry = this.history[this.index];
    this.pathname = entry.pathname;
    this.search = entry.search;
    this.hash = entry.hash;
  }
}

/** Create a memory adapter at `initialPath`. */
export const createMemoryAdapter = (initialPath = "/"): RouterAdapter => new MemoryAdapter(initialPath);
