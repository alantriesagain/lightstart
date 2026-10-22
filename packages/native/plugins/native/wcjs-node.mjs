/**
 * @file The wcjs calls (wcjs.c) on node's own engine, for running the tests of a member that embeds plugins under node: preloaded
 * with `node --import`, it defines the functions the FFI binds natively, as globals. A context is a
 * node:vm context with its microtasks run after each call (as the native core pumps QuickJS's jobs
 * after each), the same `__host` and `__invoke` protocol, and the same statuses: 0 a result, 1 an
 * error (its message, a newline, its stack), 2 the time budget run out. There is no memory limit.
 * node's timer for a call cannot pause while the core works, nested calls included, so a call gets
 * four budgets, two when made from inside a host call, one when nested deeper: a runaway plugin is
 * stopped where QuickJS stops it, later, and the calls around it go on.
 */
import vm from "node:vm";

const contexts = new Map();
let nextHandle = 1n;

const stackOf = (err) => String(err) + "\n" + String(err && err.stack ? err.stack : "");

const run = (w, code, file, done) => {
  const depth = w.replies.length;
  const budget = w.budgetMs > 0 ? w.budgetMs * (depth === 0 ? 4 : depth === 1 ? 2 : 1) : undefined;
  try {
    const v = vm.runInContext(code, w.context, { filename: file, timeout: budget });
    const text = typeof v === "string" ? v : JSON.stringify(v);
    done(0, text === undefined ? "null" : text);
    return 0;
  } catch (err) {
    const timedOut = err && err.code === "ERR_SCRIPT_EXECUTION_TIMEOUT";
    done(timedOut ? 2 : 1, timedOut ? "plugins: the plugin ran past its time budget\n" : stackOf(err));
    return timedOut ? 2 : 1;
  }
};

globalThis.wcjsNew = (_memoryMb, budgetMs) => {
  const handle = nextHandle++;
  const w = { budgetMs, host: null, replies: [], context: null };
  const sandbox = {
    __host: (name, args) => {
      if (w.host === null) throw new Error("plugins: no host");
      w.replies.push(null);
      const status = w.host(String(name), args === undefined ? "" : String(args));
      const reply = w.replies.pop();
      if (status !== 0) throw new Error(reply ?? "");
      return reply ?? "null";
    },
  };
  w.context = vm.createContext(sandbox, { microtaskMode: "afterEvaluate" });
  contexts.set(handle, w);
  return handle;
};

globalThis.wcjsSetBudget = (handle, budgetMs) => {
  contexts.get(handle).budgetMs = budgetMs;
};

globalThis.wcjsFree = (handle) => {
  contexts.delete(handle);
};

globalThis.wcjsSetHost = (handle, host) => {
  contexts.get(handle).host = host;
};

globalThis.wcjsReply = (handle, json) => {
  const w = contexts.get(handle);
  if (w.replies.length > 0) w.replies[w.replies.length - 1] = json;
};

globalThis.wcjsEval = (handle, code, file, done) => run(contexts.get(handle), code, file, done);

globalThis.wcjsInvoke = (handle, id, json, done) => {
  const w = contexts.get(handle);
  if (vm.runInContext("typeof __invoke", w.context) !== "function") {
    done(1, "plugins: __invoke is not defined");
    return 1;
  }
  return run(w, "__invoke(" + String(id) + ", " + JSON.stringify(json) + ")", "invoke", done);
};

globalThis.wcjsJobs = (_handle, _done) => 0;
