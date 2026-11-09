/**
 * @lightstart/router/click: which document clicks soft-navigate. The
 * decision walks `composedPath()` for the anchor, so a click on anything
 * inside a link finds it, and skips modified clicks, new tabs, downloads,
 * opted-out links, external links, other origins and same-page hash links.
 */

/** The part of a click event the interceptor reads. */
export interface ClickEvent {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  composedPath?: () => unknown[];
  preventDefault?(): void;
}

/** The part of a location the interceptor reads. */
export interface ClickLocation {
  origin: string;
  pathname: string;
}

interface AnchorElementLike {
  tagName: string;
  href: string;
  target: string;
  rel: string;
  origin: string;
  pathname: string;
  search: string;
  hash: string;
  hasAttribute(name: string): boolean;
}

const isAnchor = (node: unknown): node is AnchorElementLike => {
  if (typeof node !== "object" || node === null) return false;
  const candidate = node as Partial<AnchorElementLike>;
  return candidate.tagName === "A" && typeof candidate.href === "string" && candidate.href !== "" && typeof candidate.hasAttribute === "function";
};

/** The router path a click should navigate to, or null when the browser keeps it. */
export const interceptedPath = (event: ClickEvent, location: ClickLocation): string | null => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const path: unknown[] = typeof event.composedPath === "function" ? event.composedPath() : [];
  let anchor: AnchorElementLike | null = null;
  for (const node of path) {
    if (isAnchor(node)) {
      anchor = node;
      break;
    }
  }
  if (anchor === null || anchor.target || anchor.hasAttribute("download") || anchor.hasAttribute("data-no-router")) return null;
  if (/\bexternal\b/.test(anchor.rel || "")) return null;
  let url: URL;
  try {
    url = new URL(anchor.href, `${location.origin}${location.pathname}`);
  } catch {
    return null;
  }
  if (url.origin !== location.origin) return null;
  if (url.pathname === location.pathname && url.hash) return null;
  return url.pathname + url.search + url.hash;
};
