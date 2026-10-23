/**
 * @bootstrapp/light/check/types.ts: the convention checker's contract. A rule,
 * the project model it reads, the shapes the parsers answer, and what a host
 * of the engine adds to the model.
 */

/** A problem a rule reports; `line`/`col` are resolved from `offset` when absent. */
export interface Finding {
  file: string;
  message: string;
  offset?: number;
  line?: number;
  col?: number;
}

export type Styling = "css" | "tailwind";

export interface RuleApplies<M extends ProjectModel = ProjectModel> {
  styling?: Styling;
  dep?: string;
  when?: (ctx: M) => boolean;
}

export interface Reporter {
  report(finding: Finding): void;
}

/** What a rule's `check` receives: the model plus `report`. */
export type CheckContext<M extends ProjectModel = ProjectModel> = M & Reporter;

export interface CheckRule<M extends ProjectModel = ProjectModel> {
  severity: "error" | "warn";
  description: string;
  why?: string;
  appliesTo?: RuleApplies<M>;
  check: (ctx: CheckContext<M>) => void | Promise<void>;
}

export type ImportKind = "named" | "default" | "side-effect" | "reexport" | "dynamic";
export interface ParsedImport { spec: string; offset: number; kind: ImportKind }

export interface PropertyInfo { name: string; offset: number; hasNonNullDefault: boolean }

/**
 * Where a module defines a component: its default export, or a `View.define`
 * call. `literal` is the definition object when there is one, `props` the
 * props given as the call's second argument, `render` the function given in
 * the definition's place, `direct` whether the literal is the definition
 * itself rather than a factory's options, `defined` whether a `View.define`
 * call registers it.
 */
export interface Site {
  tag: string | null;
  literal: import("typescript").ObjectLiteralExpression | null;
  props: import("typescript").ObjectLiteralExpression | null;
  render: import("typescript").Expression | null;
  offset: number;
  direct: boolean;
  defined: boolean;
}

export interface ParsedComponent {
  extends: string | null;
  tag: string | null;
  styleTrue: boolean;
  /** False when `style` is present but not a literal, as in a component factory that takes it as a parameter. */
  styleKnown: boolean;
  /** Each `mixins: [...]` entry that is a named import (or a call on one): the module specifier and exported name. */
  mixins: Array<{ spec: string; exported: string }>;
  topLevelKeys: string[];
  keyOffsets: Record<string, number>;
  propertyNames: PropertyInfo[];
  propsOffset: number | null;
  /** The definition object; null for a component defined by a render function alone. */
  literal: import("typescript").ObjectLiteralExpression | null;
  sf: import("typescript").SourceFile | null;
  /** Where the definition starts in the file: the `View.define` call, or the default-exported literal. */
  offset: number;
  /** Registered by a `View.define` call, as opposed to default-exported for a loader. */
  defined: boolean;
}

export interface View extends ParsedComponent {
  file: string;
  source: string;
  isComponent: boolean;
}

/** A declared controller property; `sync` is its sync block target when that is a name. */
export interface ControllerProperty { name: string; offset: number; hasNonNullDefault: boolean; sync: string | null }
export interface MemberInfo { name: string; offset: number; kind: "method" | "value" | "shorthand" }
/** One entry of a controller's `sync` block. */
export interface SyncEntryInfo {
  prop: string;
  offset: number;
  /** The target when it is a string literal: an adapter or controller name. */
  target: string | null;
  targetOffset: number;
  /** The target's source text, whatever it is. */
  targetText: string;
  /** The long form's `key`, when it is a string literal. */
  key: string | null;
}

/** A `defineController({...})` call whose definition is a literal. */
export interface ParsedController {
  name: string | null;
  /** Each `mixins: [...]` entry that is a named import (or a call on one): the module specifier and exported name. */
  mixins: Array<{ spec: string; exported: string }>;
  topLevelKeys: string[];
  keyOffsets: Record<string, number>;
  propertyNames: ControllerProperty[];
  memberNames: MemberInfo[];
  syncEntries: SyncEntryInfo[];
  literal: import("typescript").ObjectLiteralExpression;
  sf: import("typescript").SourceFile;
  /** Where the `defineController` call starts in the file. */
  offset: number;
}

export interface Controller extends ParsedController {
  file: string;
  source: string;
}

export interface Template { content: string; start: number }
/**
 * A `class` value: the static text (an expression inside it stands as `${}`),
 * or with `template` the source of the one expression the whole value is.
 */
export interface ClassAttr { value: string; offset: number; template: boolean }

/** A template's markup as a tree; every offset is the file's own. */
export interface ParsedTemplate { start: number; content: string; children: MarkupNode[] }
export interface MarkupElement {
  kind: "element";
  tag: string;
  offset: number;
  end: number;
  attrs: MarkupAttribute[];
  children: MarkupNode[];
  parent: MarkupElement | null;
}
/**
 * An attribute as written: the prefix decides the kind and is stripped from
 * `name`; `value` is the static value, null once an expression is in it;
 * `valueOffset` is where the value's text starts in the file, null for a bare
 * attribute.
 */
export interface MarkupAttribute {
  name: string;
  kind: "attr" | "bool" | "event" | "prop";
  statics: string[];
  expressions: Array<{ offset: number; end: number }>;
  offset: number;
  value: string | null;
  valueOffset: number | null;
}
/** A text run between tags, its expressions blanked to spaces so offsets hold. */
export interface MarkupText { kind: "text"; text: string; offset: number }
/** A `${...}` in content position. */
export interface MarkupExpression { kind: "expression"; offset: number; end: number }
export type MarkupNode = MarkupElement | MarkupText | MarkupExpression;

/** The slow-code rules' `perf` block: the folders they read, the parts that compile natively, and the hot functions as `file#Class.method`. */
export interface PerfOptions {
  scope?: string[];
  native?: string[];
  hot?: string[];
}

/** `bootstrapp.check` in package.json. `allow` maps a rule id to `file` or `file#Symbol` keys, each with the reason the site is allowed. */
export interface CheckOptions {
  from?: string[];
  ignore?: string[];
  rules?: Record<string, string>;
  perf?: PerfOptions;
  allow?: Record<string, Record<string, string>>;
  noAny?: { tests?: boolean };
}

/** The `bootstrapp` block of package.json, as far as the checker reads it. Its values come from JSON, so a reader still checks their shape. */
export interface BootstrappConfig {
  [key: string]: unknown;
  components?: Record<string, string | Record<string, string>>;
  check?: CheckOptions;
}

export interface PackageJson {
  [key: string]: unknown;
  name?: string;
  version?: string;
  main?: string;
  exports?: Record<string, unknown> | string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  bootstrapp?: BootstrappConfig;
}

export interface WalkOptions {
  extensions?: readonly string[];
  recursive?: boolean;
  skipTests?: boolean;
  prune?: (name: string, rel: string) => boolean;
  keep?: (name: string, rel: string) => boolean;
}

/**
 * A `bootstrapp.components` block and the directory its paths are relative
 * to: a prefix names a directory (every file under it is `<prefix>-<path>`)
 * or a record of component name to file (`<prefix>-<name>`). `owner` is the
 * dependency's short name, null for the project itself.
 */
export interface ComponentMap {
  owner: string | null;
  dir: string;
  components: Record<string, string | Record<string, string>>;
}

export interface ComponentIndex {
  has(tag: string): boolean;
  ownerOf(tag: string): string | null;
  sourceOf(tag: string): string | null;
  /** The sources of the fragments a tag lists under `mixins`, resolved from its own file (relative specifiers only). */
  mixinSourcesOf(tag: string): string[];
  propsOf(tag: string): Set<string> | null;
}

/**
 * What a host of the engine adds to the project model: the component maps of
 * the project's dependencies, extra component directories, directories and
 * prefixes the walk leaves out, the hooks and events its plugins give every
 * component, its own notion of a dependency and of the styling engine, and a
 * path prefix the model is restricted to.
 */
export interface HostOptions {
  componentMaps?: (ctx: ProjectModel) => ComponentMap[];
  componentDirs?: (ctx: ProjectModel) => string[];
  extensions?: readonly string[];
  ignore?: { dirs?: Iterable<string>; prefixes?: Iterable<string>; prune?: (name: string, rel: string) => boolean };
  pluginHooks?: Iterable<string>;
  pluginEvents?: Iterable<string>;
  hasDep?: (dep: string, ctx: ProjectModel) => boolean;
  styling?: Styling;
  scope?: string;
  /** The files outside the project's own walk that define controllers it reaches by name (a dependency's), relative to the project. */
  controllerFiles?: (ctx: ProjectModel) => string[];
  /** The sync adapter names the host registers itself, so `sync: "<name>"` binds in every project it runs. */
  syncAdapters?: Iterable<string>;
}

/** The project model a rule reads. */
export interface ProjectModel {
  projectDir: string;
  pkg: PackageJson;
  config: BootstrappConfig;
  deps: Record<string, string>;
  componentDirs: string[];
  styling: Styling;
  /** The lifecycle hooks a host's plugins add to every component. */
  pluginHooks: ReadonlySet<string>;
  /** The events a host's plugins make every component emit. */
  pluginEvents: ReadonlySet<string>;
  hasDep(dep: string): boolean;
  files(): string[];
  read(rel: string): string | null;
  code(rel: string): string | null;
  /** One per definition, several per file; a component-dir file defining nothing yields one placeholder with `isComponent: false`. */
  views(): View[];
  viewsIn(rel: string): View[];
  /** The distinct files `views()` come from, for a rule that reads a file once. */
  componentFiles(): string[];
  componentIndex(): ComponentIndex;
  templates(rel: string): Template[];
  /** The file's templates as trees, one per `html` or `svg` template. */
  markup(rel: string): ParsedTemplate[];
  imports(rel: string): ParsedImport[];
  classAttrs(rel: string): ClassAttr[];
  assetFiles(dir: string): string[];
  /** Every `defineController` call in the project's scripts, tests aside. */
  controllers(): Controller[];
  controllersIn(rel: string): Controller[];
  /** The controllers of the host's `controllerFiles`. */
  dependencyControllers(): Controller[];
  /** The sync adapter names a `sync: "<name>"` can bind to: the host's and every `registerAdapter("<name>", ...)` or `createDocumentAdapter("<name>")` in the project. */
  syncAdapters(): Set<string>;
}

/** The model plus what the runners need. */
export type ProjectContext<M extends ProjectModel = ProjectModel> = M & {
  lineAt(rel: string, offset: number): { line: number; col: number };
  /** Drop what is cached of a file; `text` stands in for its content until it is invalidated without one. */
  invalidate(rel: string, text?: string): void;
};

export interface RuleEntry<M extends ProjectModel = ProjectModel> { id: string; owner: string; file: string; rule: CheckRule<M> }

/** A rule file and the owner its id is derived from. */
export interface RuleSource { owner: string; file: string }

export interface RunOptions<M extends ProjectModel = ProjectModel> {
  context: ProjectContext<M>;
  rules: RuleEntry<M>[];
  ruleFilter?: string;
  overrides?: Record<string, string>;
}

export interface ReportedFinding { ruleId: string; severity: "error" | "warn"; file: string; line: number; col: number; message: string }

export interface CatalogEntry {
  id: string;
  owner: string;
  declaredSeverity: string;
  effectiveSeverity: string;
  status: "active" | "off" | "n/a";
  reason?: string;
  description: string;
  why?: string;
}

export interface CheckResult {
  rules: CatalogEntry[];
  findings: ReportedFinding[];
  configWarnings: string[];
  stats: { files: number; rules: number; errors: number; warnings: number; durationMs: number };
}
