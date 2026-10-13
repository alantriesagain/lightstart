/**
 * @bootstrapp/light/env: the page's environment as components read it.
 */

/** A point-in-time read of `env` (the data fields, no methods). */
export interface EnvSnapshot {
  /** The OS, from the user agent. */
  os: "ios" | "android" | "macos" | "windows" | "linux" | "unknown";
  isTouch: boolean;
  pixelRatio: number;
  /** Viewport width (CSS px). */
  width: number;
  /** Viewport height (CSS px). */
  height: number;
  screenWidth: number;
  screenHeight: number;
  orientation: "portrait" | "landscape";
  breakpoint: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
  /** Viewport width below the `md` (768px) breakpoint. */
  isMobile: boolean;
  isDesktop: boolean;
  /** `prefers-color-scheme: dark` at the OS or browser level. */
  prefersDark: boolean;
  /** The applied color scheme (`<html class="dark">`). */
  dark: boolean;
}

/**
 * The window a page runs in, when a desktop shell gave it one (light's `DesktopWindow` installs it
 * as `window.__desktopWindow`): what a title bar needs to drive the window and follow its state.
 */
export interface WindowHost {
  /** The platform the window lives on. */
  platform: "linux" | "macos" | "windows";
  /** The window has no system title bar; the page draws one. */
  frameless: boolean;
  /** The system's own controls stay on the window (macOS traffic lights); the page leaves room for them. */
  nativeControls: boolean;
  /** Pixels to leave free at the bar's start for the system's controls (0 when there are none). */
  controlsInset: number;
  maximized: boolean;
  fullscreen: boolean;
  focused: boolean;
  minimized: boolean;
  minimize(): void;
  toggleMaximize(): void;
  /** Close the window as its system close button would. */
  close(): void;
  /** Start moving the window with the pointer, while the primary button is down; `x`, `y` (screen) anchor it at the press. */
  startDrag(x?: number, y?: number): void;
  /** Hand a mousedown on a title bar to the window: a drag moves it, a double-click maximizes or restores it. */
  dragFrom(event: MouseEvent): void;
  /** Called with the host whenever its state changes; answers the function that stops it. */
  subscribe(fn: (host: WindowHost) => void): () => void;
}

export interface Env extends EnvSnapshot {
  /** The window, when a desktop shell gave the page one; null in a browser. Not part of the snapshot. */
  readonly window: WindowHost | null;
  /** A plain-object copy of the current values. */
  snapshot(): EnvSnapshot;
  /** Called with a fresh snapshot on resize (debounced), orientation, color-scheme and `dark` class changes. */
  subscribe(fn: (snapshot: EnvSnapshot) => void): () => void;
}

export * from "./index.js";
export { default } from "./index.js";
