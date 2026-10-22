/**
 * @file One QuickJS context as the core uses it: evaluating a plugin's source, invoking a plugin's
 * function by the id the prelude gave it, running promise jobs, and answering a plugin's
 * `__host(name, json)` through a HostHandler. The wcjs functions are bound natively by the FFI
 * manifest (native/ffi.json); under node the tests preload wcjs-node.mjs, the same
 * calls on node's own engine. Every value crosses as text, JSON by convention.
 *
 * What the core throws becomes the plugin's error, not the core's.
 */
import { errorMessage } from "@light/lib/json.ts";
declare function wcjsNew(memoryMb: number, budgetMs: number): bigint;
declare function wcjsSetBudget(ctx: bigint, budgetMs: number): void;
declare function wcjsFree(ctx: bigint): void;
declare function wcjsSetHost(ctx: bigint, host: (name: string, args: string) => number): void;
declare function wcjsReply(ctx: bigint, json: string): void;
declare function wcjsEval(ctx: bigint, code: string, file: string, done: (status: number, text: string) => void): number;
declare function wcjsInvoke(ctx: bigint, id: number, json: string, done: (status: number, text: string) => void): number;
declare function wcjsJobs(ctx: bigint, done: (status: number, text: string) => void): number;

/** A call's outcome: a result, an error (its message, a newline, its stack), or the time budget run out. */
export const OK = 0;
export const FAILED = 1;
export const OVER_BUDGET = 2;

export class JsResult {
  status: number;
  text: string;

  constructor(status: number, text: string) {
    this.status = status;
    this.text = text;
  }

  /** An error's first line (its message). */
  message(): string {
    const at = this.text.indexOf("\n");
    return at >= 0 ? this.text.slice(0, at) : this.text;
  }
}

/** The core's answer to a plugin's call: OK and JSON text, or FAILED and an error's message. */
export class HostAnswer {
  status: number;
  text: string;

  constructor(status: number, text: string) {
    this.status = status;
    this.text = text;
  }
}

export abstract class HostHandler {
  /** Answer `__host(name, args)`, `args` the JSON array of the call's arguments. */
  abstract answer(name: string, args: string): HostAnswer;
}

/** The core's side of the plugins: answering their calls, and calling their functions. */
export abstract class Bridge extends HostHandler {
  /** Call plugin `owner`'s function `id` with `args` (a JSON array). */
  abstract invoke(owner: string, id: number, args: string): JsResult;
  /** The same with a budget of `budgetMs` (an agent's history read). */
  abstract invokeLong(owner: string, id: number, args: string, budgetMs: number): JsResult;
}

export class JsEngine {
  private readonly ctx: bigint;
  private live = true;

  constructor(handler: HostHandler, memoryMb: number, budgetMs: number) {
    this.ctx = wcjsNew(memoryMb, budgetMs);
    const ctx = this.ctx;
    wcjsSetHost(ctx, (name: string, args: string): number => {
      let a = new HostAnswer(FAILED, "plugins: " + name + " failed");
      try {
        a = handler.answer(name, args);
      } catch (err) {
        a = new HostAnswer(FAILED, "plugins: " + name + ": " + (errorMessage(err, String(err))));
      }
      wcjsReply(ctx, a.text);
      return a.status;
    });
  }

  /** Evaluate `code` as a script named `file`. */
  eval(code: string, file: string): JsResult {
    let out = new JsResult(FAILED, "plugins: no result");
    if (!this.live) return out;
    wcjsEval(this.ctx, code, file, (status: number, text: string) => {
      out = new JsResult(status, text);
    });
    return out;
  }

  /** The budget the next calls start with. */
  setBudget(budgetMs: number): void {
    if (this.live) wcjsSetBudget(this.ctx, budgetMs);
  }

  /** Call the plugin function the prelude numbered `id` with `args` (a JSON array). */
  invoke(id: number, args: string): JsResult {
    let out = new JsResult(FAILED, "plugins: no result");
    if (!this.live) return out;
    wcjsInvoke(this.ctx, id, args, (status: number, text: string) => {
      out = new JsResult(status, text);
    });
    return out;
  }

  /** Run the pending promise jobs; the errors they threw. */
  jobs(): JsResult[] {
    const errors: JsResult[] = [];
    if (!this.live) return errors;
    wcjsJobs(this.ctx, (status: number, text: string) => {
      errors.push(new JsResult(status, text));
    });
    return errors;
  }

  free(): void {
    if (!this.live) return;
    this.live = false;
    wcjsFree(this.ctx);
  }
}
