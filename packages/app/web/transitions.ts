/// <reference lib="dom" />
/**
 * @file The web host's view transitions and morph, imported only when the app
 * declares `transitions: true`: the route change inside
 * `document.startViewTransition`, the clicked or named source morphed into the
 * next view's `[data-morph]` element, the reversed history entry, and light's
 * default `morph` rules. The host's own `transition` is the plain default.
 */

import { flushUpdates } from "@lightstart/light/view/core";
import { currentView } from "../run.ts";
import type { RouteTransition } from "../run.ts";
import type { WebTransitionFeature, WebTransitionPort } from "./features.ts";

const morphStyles = `
@layer light {
  ::view-transition-group(morph) {
    animation-duration: 420ms;
    animation-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
  ::view-transition-old(morph),
  ::view-transition-new(morph) {
    height: 100%;
    width: 100%;
    object-fit: none;
    object-position: left top;
  }
  ::view-transition-image-pair(morph) {
    overflow: clip;
  }
  ::view-transition-old(morph) {
    animation: light-morph-out 420ms cubic-bezier(0.2, 0, 0, 1);
  }
  ::view-transition-new(morph) {
    animation: light-morph-in 420ms cubic-bezier(0.2, 0, 0, 1);
  }
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 220ms;
  }
  @keyframes light-morph-out {
    0% { opacity: 1; }
    35% { opacity: 0; }
    100% { opacity: 0; }
  }
  @keyframes light-morph-in {
    0% { opacity: 0; }
    35% { opacity: 1; }
    100% { opacity: 1; }
  }
}
`;

/** The path of an `href`, for matching a remembered entry against the route now shown. */
const pathOfHref = (href: string): string => {
  try {
    return new URL(href, globalThis.location?.href ?? "http://memory").pathname;
  } catch {
    return href;
  }
};

/** A click that may start a navigation: the anchor, the path it leads to, and when it happened. */
interface ClickSource {
  element: Element;
  path: string;
  at: number;
}

/** The web host's view transitions: installed only when the entry passes this feature to `start`. */
export class Transitions implements WebTransitionFeature {
  private stylesInstalled = false;
  /** For each history entry, the route path a morph-forward navigation led to. */
  private readonly ledTo = new Map<string, string>();
  /** The anchor a recent click went through, dropped once a navigation uses it or another route change happens. */
  private clickSource: ClickSource | null = null;
  /** The element carrying the `morph` name now, with the inline value to restore. */
  private named: { element: HTMLElement; previous: string } | null = null;

  /** Install light's default `morph` transition rules once, in the `light` layer so an app's own rules win. */
  installStyles(): void {
    if (this.stylesInstalled) return;
    if (document.getElementById("light-morph") !== null) {
      this.stylesInstalled = true;
      return;
    }
    const style = document.createElement("style");
    style.id = "light-morph";
    style.textContent = morphStyles;
    document.head.append(style);
    this.stylesInstalled = true;
  }

  /** Run the route change inside `document.startViewTransition` where the browser has it, morphing the source into the next view, then wait for `<app-container>` to draw it. */
  transition(apply: () => Promise<void> | void, route: RouteTransition | undefined, port: WebTransitionPort): Promise<void> {
    this.installStyles();
    const doc = globalThis.document;
    const start = (doc as unknown as { startViewTransition?: (callback: () => Promise<void> | void) => { finished: Promise<void> } }).startViewTransition;
    if (typeof start !== "function") return Promise.resolve(apply()).then(() => undefined);
    const reduced = typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const path = route?.path ?? "";
    const historyNavigation = port.historyNavigation();
    const from = this.sourceOf(route?.from, path);
    const currentHref = port.href();
    const leftPath = currentHref === null ? null : pathOfHref(currentHref);
    const reverse = historyNavigation && leftPath !== null && route?.href !== undefined && this.ledTo.get(route.href) === leftPath;
    const morph = !reduced && (historyNavigation ? reverse : from !== null);
    if (morph) {
      if (historyNavigation) this.nameMorph(this.oldMorphElement(port));
      else if (from !== null) {
        this.nameMorph(from);
        if (currentHref !== null) this.ledTo.set(currentHref, path);
      }
    }
    this.clickSource = null;
    // The browser pauses rendering, and with it the frame light's host flushes on, until this callback settles: draw the
    // container and the next view now, so the snapshot has the page the user will see and the callback never waits on a frame.
    const update = (): Promise<void> => Promise.resolve(apply()).then(async () => {
      await this.drawNextView(port);
      if (!morph) return;
      this.clearMorph();
      if (historyNavigation) this.nameMorph(leftPath === null ? null : this.returnMorphElement(port, leftPath));
      else this.nameMorph(this.newMorphElement(port));
    });
    const done = new Promise<void>((resolve, reject) => {
      let transition: { finished: Promise<void> };
      try {
        transition = start.call(doc, update);
      } catch (error) {
        this.clearMorph();
        reject(error);
        return;
      }
      transition.finished.then(() => resolve(), () => resolve());
    });
    return done.then(() => {
      this.clearMorph();
    }, (error: unknown) => {
      this.clearMorph();
      throw error;
    });
  }

  /** Remember the anchor a document click goes through, before the router's own listener sees it. */
  recordClick(event: Event): void {
    if (!(event instanceof MouseEvent)) return;
    let anchor: Element | null = null;
    for (const node of event.composedPath()) {
      if (node instanceof Element && node.tagName === "A") {
        anchor = node;
        break;
      }
    }
    if (!(anchor instanceof HTMLAnchorElement) || anchor.href === "") {
      this.clickSource = null;
      return;
    }
    try {
      this.clickSource = { element: anchor, path: new URL(anchor.href).pathname, at: Date.now() };
    } catch {
      this.clickSource = null;
    }
  }

  /** Drop the remembered click, so a later route change does not morph from it. */
  clearClick(): void {
    this.clickSource = null;
  }

  /** Clear the name and the remembered click when the run unmounts. */
  reset(): void {
    this.clearMorph();
    this.clickSource = null;
  }

  /** Flush the pending updates until `<app-container>` holds the view the route now answers, so a morph's target can be found. */
  private async drawNextView(port: WebTransitionPort): Promise<void> {
    for (let round = 0; round < 50; round++) {
      flushUpdates();
      const view = currentView.peek();
      const first = port.container()?.firstElementChild ?? null;
      if (view === null ? first === null : first !== null && first.tagName.toLowerCase() === view) return;
      await Promise.resolve();
    }
    flushUpdates();
  }

  /** The source a navigation morphs from: the one the call names, else a fresh click on the path this navigation takes. */
  private sourceOf(given: RouteTransition["from"], path: string): Element | null {
    if (given instanceof Element) return given;
    const click = this.clickSource;
    if (click === null) return null;
    if (Date.now() - click.at > 1000 || click.path !== path) {
      this.clickSource = null;
      return null;
    }
    return click.element;
  }

  /** Name `element` the transition's `morph`, keeping the name to itself and remembering its inline value. */
  private nameMorph(element: Element | null): void {
    if (!(element instanceof HTMLElement)) return;
    if (this.named !== null && this.named.element !== element) this.clearMorph();
    if (this.named !== null && this.named.element === element) return;
    this.named = { element, previous: element.style.viewTransitionName };
    element.style.viewTransitionName = "morph";
  }

  /** Clear the `morph` name, restoring the inline value the element had. */
  private clearMorph(): void {
    const named = this.named;
    this.named = null;
    if (named === null) return;
    named.element.style.viewTransitionName = named.previous;
  }

  /** The current view's `[data-morph]` element, else the view element itself. */
  private oldMorphElement(port: WebTransitionPort): Element | null {
    const container = port.container();
    if (container === null) return null;
    return container.querySelector("[data-morph]") ?? container.firstElementChild;
  }

  /** The next view's first `[data-morph]` element, else the view element itself. */
  private newMorphElement(port: WebTransitionPort): Element | null {
    return this.oldMorphElement(port);
  }

  /** On the restored page, the first anchor to `path`, preferring one marked `data-morph-source`; none is a plain cross-fade. */
  private returnMorphElement(port: WebTransitionPort, path: string): Element | null {
    const scope = port.root();
    if (scope === null) return null;
    let plain: Element | null = null;
    for (const anchor of scope.querySelectorAll("a[href]")) {
      if (!(anchor instanceof HTMLAnchorElement) || pathOfHref(anchor.href) !== path) continue;
      if (anchor.hasAttribute("data-morph-source")) return anchor;
      if (plain === null) plain = anchor;
    }
    return plain;
  }
}
