/// <reference lib="dom" />
/**
 * @file @lightstart/pwa/page: the page's side of a PWA. `registerPwa` registers
 * `<base>/sw.js` with scope `<base>/`, and the shared `pwa` follows a waiting
 * worker and acts on the config's update policy. The module is web-only.
 */

import { currentRoute } from "@lightstart/app/web";
import { effect, signal, type Signal } from "@lightstart/light/signals";
import { baseScope, normalizeBase, withBase } from "./base.ts";
import type { PwaConfig, PwaUpdate } from "./index.ts";

/** What a page knows about a new worker: whether one is installed and waiting. */
export interface PwaUpdateState {
  waiting: boolean;
}

/** What `registerPwa` takes: the app's deploy base. */
export interface PwaPageOptions {
  /** The app's base, `""` at the root. */
  base?: string;
}

/** The page's PWA: the update signal, and the two actions the app or a toast calls. */
export interface PwaPage {
  /** A signal of `{ waiting }`: true when a new worker is installed and waiting. */
  readonly update: Signal<PwaUpdateState>;
  /** Tell the waiting worker to activate, and reload once it controls the page. */
  apply(): Promise<void>;
  /** Ask the browser for a new worker now; a check that fails leaves the current worker in place. */
  check(): Promise<void>;
}

const INTERVAL = 15 * 60 * 1000;

class LivePwa implements PwaPage {
  readonly update = signal<PwaUpdateState>({ waiting: false });
  private registration: ServiceWorkerRegistration | null = null;
  private registering: Promise<ServiceWorkerRegistration | null> | null = null;
  private waiting: ServiceWorker | null = null;
  private reloadOnChange = false;
  private policy: PwaUpdate = "prompt";
  private timer: ReturnType<typeof setInterval> | null = null;

  async apply(): Promise<void> {
    const waiting = this.waiting;
    if (waiting === null) return;
    this.reloadOnChange = true;
    this.markWaiting(null);
    waiting.postMessage({ type: "pwa:skip-waiting" });
  }

  async check(): Promise<void> {
    const registration = this.registration ?? (await this.registering);
    this.registration = registration;
    if (registration === null) return;
    try {
      await registration.update();
    } catch {
      return;
    }
  }

  connect(config: PwaConfig, options: PwaPageOptions): PwaPage {
    this.policy = config.update ?? "prompt";
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return this;
    const base = normalizeBase(options.base);
    this.registering = navigator.serviceWorker
      .register(withBase(base, "/sw.js"), { scope: baseScope(base) })
      .then((registration) => {
        this.registration = registration;
        this.watch(registration);
        this.followPolicy();
        this.schedule();
        return registration;
      })
      .catch(() => null);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!this.reloadOnChange) return;
      this.reloadOnChange = false;
      location.reload();
    });
    void this.check();
    return this;
  }

  private watch(registration: ServiceWorkerRegistration): void {
    const consider = (): void => {
      if (registration.waiting !== null) this.markWaiting(registration.waiting);
    };
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (installing === null) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" || installing.state === "redundant") consider();
      });
      consider();
    });
    consider();
  }

  private markWaiting(worker: ServiceWorker | null): void {
    this.waiting = worker;
    const waiting = worker !== null;
    if (this.update.peek().waiting !== waiting) this.update.value = { waiting };
    if (waiting && this.policy === "force") void this.apply();
  }

  private followPolicy(): void {
    if (this.policy !== "silent") return;
    let route = currentRoute.peek();
    effect(() => {
      const next = currentRoute.value;
      if (next === route) return;
      route = next;
      if (this.waiting !== null) void this.apply();
    });
  }

  private schedule(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      void this.check();
    }, INTERVAL);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void this.check();
      });
    }
  }
}

const page = new LivePwa();

/** The page's PWA, shared by `registerPwa`, the update policy and `<pwa-update-toast>`. */
export const pwa: PwaPage = page;

/** Register the app's worker and follow the config's update policy; answers the shared `pwa`. */
export const registerPwa = (config: PwaConfig, options: PwaPageOptions = {}): PwaPage => page.connect(config, options);
