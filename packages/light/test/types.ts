/**
 * The browser `node:test` runner: the shapes `harness.js`, `mock.js` and
 * `report.js` work with.
 */

import type { MockTracker } from "./mock.js";

export type TestStatus = "pass" | "fail" | "skip" | "todo";

export interface TestOptions {
  skip?: boolean | string;
  todo?: boolean | string;
  only?: boolean;
  timeout?: number;
  concurrency?: number | boolean;
  plan?: number;
}

export interface Hook {
  fn: (context?: unknown) => unknown;
  options?: Record<string, unknown>;
}

export interface HookSet {
  before: Hook[];
  after: Hook[];
  beforeEach: Hook[];
  afterEach: Hook[];
}

/** The body of a test: it receives the test context. */
export type TestFn = (context: TestContext) => unknown;

/** The body of a describe: it receives the suite context, and must be synchronous. */
export type SuiteFn = (context: SuiteContext) => unknown;

/** The `context` a describe body receives. */
export interface SuiteContext {
  name: string;
  signal: AbortSignal | undefined;
}

/** A suite or a test: one node of the registration tree. */
export interface TestNode {
  kind: "suite" | "test";
  name: string;
  parent: TestNode | null;
  options: TestOptions;
  children: TestNode[];
  hooks?: HookSet;
  fn?: TestFn;
  registrationError?: Error | null;
  controller?: AbortController;
  afterHooks?: Hook[];
  /** `t.before` hooks, run once before the first subtest. */
  beforeHooks?: Hook[];
  beforeRan?: boolean;
}

/** A suite always carries its hook set; only a test may be without one. */
export interface SuiteNode extends TestNode {
  kind: "suite";
  hooks: HookSet;
}

export interface TestResult {
  name: string[];
  status: TestStatus;
  durationMs: number;
  error: Error | null;
  reason?: string | undefined;
  diagnostics: string[];
  subtests: TestResult[];
  assertions: number;
  plan: number | null;
  childFailed: boolean;
  isSuite?: boolean;
}

export interface RunCounts {
  pass: number;
  fail: number;
  skip: number;
  todo: number;
  total: number;
  suites: number;
}

export interface RunOutcome {
  results: TestResult[];
  counts: RunCounts;
  durationMs: number;
}

/** The `t` a test body receives; node's TestContext. */
export interface TestContext {
  name: string;
  fullName: string;
  signal: AbortSignal;
  mock: MockTracker;
  assert: Record<string, LooseFn>;
  diagnostic(message: string): void;
  skip(message?: string): void;
  todo(message?: string): void;
  plan(count: number): void;
  runOnly(value?: boolean): void;
  before(fn: Hook["fn"], options?: Hook["options"]): void;
  after(fn: Hook["fn"], options?: Hook["options"]): void;
  beforeEach(): never;
  afterEach(): never;
  test(nameOrFn: unknown, optionsOrFn?: unknown, maybeFn?: unknown): Promise<TestResult>;
}

/** A function whose signature the runner does not know: a mock target, an assert entry. */
export type AnyFn = (...args: never[]) => unknown;

/** The fallback for a mock with no original: it accepts whatever the test calls it with. */
export type LooseFn = (...args: unknown[]) => unknown;

/** One recorded call on a mocked function, shaped like node's. */
export interface MockCall {
  arguments: unknown[];
  error: unknown;
  result: unknown;
  stack: Error;
  target: unknown;
  this: unknown;
}

export interface MockContext {
  calls: MockCall[];
  callCount(): number;
  mockImplementation(fn: AnyFn): void;
  mockImplementationOnce(fn: AnyFn, onCall?: number): void;
  resetCalls(): void;
  restore(): void;
  _implementationFor(index: number): AnyFn | undefined;
  _record(entry: MockCall): void;
}

export type MockedFn<F extends AnyFn = AnyFn> = F & { mock: MockContext };

/** The cycle guard threaded through a deep comparison: every object already compared to which others. */
export type Memo = Map<object, Set<unknown>>;

/** A function `assert.throws`/`assert.rejects` accept as the expectation: an error class the error is an instance of, or a validator that answers `true`. */
export interface ErrorFunction {
  (error: unknown): unknown;
  readonly prototype: unknown;
  readonly name: string;
}

/** What `assert.throws`/`assert.rejects` accept as the expectation on the thrown error. */
export type ErrorMatcher = RegExp | ErrorFunction | object | string;

/** An error as it crosses the page boundary: `Error` does not survive JSON. */
export interface SerializedError {
  name: string;
  code?: string | undefined;
  message: string;
  operator?: string | undefined;
  stack: string[];
  actualText?: string;
  expectedText?: string;
  diff?: string[];
  cause?: SerializedError | null;
}

/** One test in the JSON the runner page posts back. */
export interface WireResult {
  name: string[];
  status: TestStatus;
  durationMs: number;
  reason: string | undefined;
  diagnostics: string[];
  error: SerializedError | null;
  subtests: WireResult[];
}

/** A whole file's run, as the runner page publishes it on `window.testResults`. */
export interface WireRun {
  shimLoaded: boolean;
  file: string | null;
  loadError: SerializedError | null;
  durationMs: number;
  counts: RunCounts;
  tests: WireResult[];
  failures: WireResult[];
}

declare global {
  /** Set by the `node:test` shim so the runner can tell the importmap resolved. */
  var __NODE_TEST_SHIM__: boolean | undefined;
  /** Published by the runner page once the file has run. */
  var testResults: WireRun | undefined;
}
