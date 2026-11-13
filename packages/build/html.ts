/**
 * @file A small page scanner: the importmap script, module scripts (external and inline) and
 * stylesheet links, with the ranges needed to rewrite the page while everything else stays as it is.
 */
import { resolve } from "node:path";

/** One module script: a file or inline code, at an absolute path when it is a file. */
export type PageModule =
  | { kind: "external"; src: string; path: string }
  | { kind: "inline"; code: string };

/** One linked stylesheet, resolved from the page. */
export type PageStylesheet = { href: string; path: string };

/** A half-open span of the page's text. */
export type PageRange = { start: number; end: number };

/** What the page holds: its importmap, module scripts and stylesheets, each with its range. */
export type ParsedPage = {
  html: string;
  importMapText: string | null;
  importMapRanges: PageRange[];
  modules: PageModule[];
  moduleRanges: PageRange[];
  stylesheets: PageStylesheet[];
  stylesheetRanges: PageRange[];
};

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const LINK = /<link\b([^>]*?)\/?>/gi;
const ATTRIBUTE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

const parseAttributes = (raw: string): Map<string, string> => {
  const attrs = new Map<string, string>();
  for (const match of raw.matchAll(ATTRIBUTE)) {
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attrs.set(match[1]!.toLowerCase(), value);
  }
  return attrs;
};

const rangeOf = (match: RegExpMatchArray): PageRange => {
  const start = match.index ?? 0;
  return { start, end: start + match[0].length };
};

/** Scan a page's HTML for its importmap, module scripts and stylesheet links. */
export const parsePage = (html: string, pageDir: string): ParsedPage => {
  const parsed: ParsedPage = {
    html,
    importMapText: null,
    importMapRanges: [],
    modules: [],
    moduleRanges: [],
    stylesheets: [],
    stylesheetRanges: [],
  };

  for (const match of html.matchAll(SCRIPT)) {
    const attrs = parseAttributes(match[1] ?? "");
    const type = (attrs.get("type") ?? "").toLowerCase();
    const range = rangeOf(match);
    if (type === "importmap") {
      if (parsed.importMapText === null) parsed.importMapText = match[2] ?? "";
      parsed.importMapRanges.push(range);
      continue;
    }
    if (type !== "module") continue;
    const src = attrs.get("src");
    parsed.modules.push(src === undefined ? { kind: "inline", code: match[2] ?? "" } : { kind: "external", src, path: resolve(pageDir, src) });
    parsed.moduleRanges.push(range);
  }

  for (const match of html.matchAll(LINK)) {
    const attrs = parseAttributes(match[1] ?? "");
    const rel = (attrs.get("rel") ?? "").toLowerCase().split(/\s+/);
    const href = attrs.get("href");
    if (href === undefined || !rel.includes("stylesheet")) continue;
    parsed.stylesheets.push({ href, path: resolve(pageDir, href) });
    parsed.stylesheetRanges.push(rangeOf(match));
  }

  return parsed;
};

const replaceHref = (tag: string, url: string): string => tag.replace(/(\bhref\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `$1"${url}"`);

/** Render the page with the importmap gone, module scripts pointing at their bundles and stylesheet links at their outputs. */
export const renderPage = (page: ParsedPage, moduleUrls: readonly (string | undefined)[], styleUrls: readonly (string | undefined)[]): string => {
  const replacements: { range: PageRange; text: string }[] = [];
  for (const range of page.importMapRanges) replacements.push({ range, text: "" });
  page.modules.forEach((_module, index) => {
    const url = moduleUrls[index];
    if (url !== undefined) replacements.push({ range: page.moduleRanges[index]!, text: `<script type="module" src="${url}"></script>` });
  });
  page.stylesheets.forEach((_stylesheet, index) => {
    const url = styleUrls[index];
    if (url === undefined) return;
    const range = page.stylesheetRanges[index]!;
    replacements.push({ range, text: replaceHref(page.html.slice(range.start, range.end), url) });
  });
  replacements.sort((a, b) => b.range.start - a.range.start);
  let out = page.html;
  for (const replacement of replacements) out = out.slice(0, replacement.range.start) + replacement.text + out.slice(replacement.range.end);
  return out;
};
