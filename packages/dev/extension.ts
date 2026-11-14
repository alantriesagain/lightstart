/**
 * @file The api `light serve` opens to extensions: the root app every request goes through, apps
 * tried behind the project's routes, more file roots, the importmap, the page renderer, more
 * watched folders, base paths, build previews and the payload serve hooks receive.
 */
import { App, Context, Incoming, type Reply, fail } from "@lightstart/server";
import type { ImportMap } from "./importmap.ts";
import { renderShell } from "./shell.ts";

/** A folder of files served under a URL prefix, like the project's own. */
export type ServeRoot = {
  prefix: string;
  dir: string;
};

/** A folder watched under `--watch`, its changes named by `label`. */
export type ServeWatch = {
  dir: string;
  label: string;
};

/** What `light serve` hands an extension; it widens `Extensions`, as hooks widen `Hooks`. */
export class ServeExtension {
  /** The folder being served. */
  readonly projectDir: string;
  /** The root app every request goes through first. */
  readonly app: App;
  /** The merged importmap, mutable before the server listens. */
  readonly importmap: ImportMap;
  /** The apps tried after the project's route files and before its files, in the order added. */
  readonly handled: App[];
  /** The extra file roots, in the order added. */
  readonly roots: ServeRoot[];
  /** The extra watched folders, in the order added. */
  readonly watches: ServeWatch[];
  /** The base paths the app is also answered under. */
  readonly basePaths: string[];
  /** The ports a strict build preview is started on. */
  readonly previews: number[];
  /** The fields every serve hook's payload carries, writable during setup. */
  readonly payload: Record<string, unknown>;
  /** The fields every route file's context carries beside the project, the log and the CLI, writable during setup. */
  readonly routeContext: Record<string, unknown>;
  private renderer: ((c: Context, html: string) => string) | null;
  private pagePath: string | null;
  private fallbackPort: number | null;

  constructor(projectDir: string, importmap: ImportMap) {
    this.projectDir = projectDir;
    this.app = new App();
    this.importmap = importmap;
    this.handled = [];
    this.roots = [];
    this.watches = [];
    this.basePaths = [];
    this.previews = [];
    this.payload = {};
    this.routeContext = {};
    this.renderer = null;
    this.pagePath = null;
    this.fallbackPort = null;
  }

  /** The port to start from when neither `--port`, `light.dev.port` nor `PORT` names one. */
  defaultPort(port: number): void {
    this.fallbackPort = port;
  }

  /** The port `defaultPort` named, or null. */
  defaultPortValue(): number | null {
    return this.fallbackPort;
  }

  /** Try `app` after the project's route files and before its files; a path it has no route for falls through. */
  handle(app: App): void {
    this.handled.push(app);
  }

  /** Serve `dir` under `prefix`, with TypeScript stripped and specifiers rewritten as the project's files are. */
  root(prefix: string, dir: string): void {
    this.roots.push({ prefix, dir });
  }

  /** Replace how the shell's HTML is produced from the page; the default injects the importmap and the reload client. */
  page(render: (c: Context, html: string) => string): void {
    this.renderer = render;
  }

  /** Name another file as the page when the project has no `index.html`; a relative path is from the project. */
  pageFile(path: string): void {
    this.pagePath = path;
  }

  /** The page file named by `pageFile`, or null for the project's `index.html`. */
  pageFilePath(): string | null {
    return this.pagePath;
  }

  /** Watch one more folder under `--watch`; its changes reach `serve:file-changed` as `label` and the relative path. */
  watch(dir: string, label: string): void {
    this.watches.push({ dir, label });
  }

  /** Answer the app under `path` as well as at the root, `/path` itself as the app's root. */
  basePath(path: string): void {
    const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
    this.basePaths.push(trimmed.startsWith("/") ? trimmed : "/" + trimmed);
  }

  /** Start the strict build preview over `.deployed/current` on `port` beside the dev server. */
  preview(port: number): void {
    this.previews.push(port);
  }

  /** The shell's HTML for a page: the extension's renderer when it set one, else the default importmap and reload client. */
  renderPage(c: Context, html: string, reload: boolean): string {
    if (this.renderer !== null) return this.renderer(c, html);
    return renderShell(html, this.importmap, { reload });
  }
}

class BaseIncoming extends Incoming {
  private readonly source: Incoming;
  private readonly base: string;

  constructor(source: Incoming, base: string) {
    super();
    this.source = source;
    this.base = base;
  }

  method(): string {
    return this.source.method();
  }

  target(): string {
    const target = this.source.target();
    const q = target.indexOf("?");
    const path = q < 0 ? target : target.slice(0, q);
    const search = q < 0 ? "" : target.slice(q);
    const rest = path.slice(this.base.length);
    return (rest === "" ? "/" : rest) + search;
  }

  header(name: string): string | null {
    return this.source.header(name);
  }

  headerPairs(): string[] {
    return this.source.headerPairs();
  }

  text(limit: number): Promise<string> {
    return this.source.text(limit);
  }

  bytes(limit: number): Promise<Uint8Array> {
    return this.source.bytes(limit);
  }

  remoteAddress(): string {
    return this.source.remoteAddress();
  }

  host(): string {
    return this.source.host();
  }

  protocol(): string {
    return this.source.protocol();
  }

  signal(): AbortSignal {
    return this.source.signal();
  }

  override abort(reason: string): void {
    this.source.abort(reason);
  }

  override env(): unknown {
    return this.source.env();
  }

  override original(): Request | null {
    return this.source.original();
  }

  waitUntil(work: Promise<void>): void {
    this.source.waitUntil(work);
  }
}

/** The context for `c` with `base` stripped from its path. */
export const withBase = (c: Context, base: string): Context => new Context(new BaseIncoming(c.incoming, base));

/** An app that answers `app` under each base path as well as at the root, `/base` itself as the app's root. */
export const withBasePaths = (app: App, basePaths: readonly string[]): App => {
  if (basePaths.length === 0) return app;
  const outer = new App();
  for (const base of basePaths) {
    outer.all(base, async (c: Context): Promise<Reply> => (await app.handle(withBase(c, base))) ?? fail("Not found: " + c.path, 404));
    outer.all(base + "/*", async (c: Context): Promise<Reply> => (await app.handle(withBase(c, base))) ?? fail("Not found: " + c.path, 404));
  }
  outer.all("/*", async (c: Context): Promise<Reply> => (await app.handle(c)) ?? fail("Not found: " + c.path, 404));
  return outer;
};
