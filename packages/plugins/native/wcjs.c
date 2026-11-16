// wcjs: an app's embedded QuickJS, as the compiled core sees it through scriptc's FFI. Every value
// crosses as UTF-8 text (JSON by convention). The core evaluates code and invokes the plugins'
// functions; a result, or an error with its stack, comes back through a call-scoped callback,
// since FFI cannot return a string. A plugin calls the core through `__host(name, json)`, which
// reaches the retained host callback; the core answers with `wcjs_reply` before that callback
// returns (a stack, so a host call may itself call into JS and back). Each call from the core
// into JS has a budget of CPU time, and the host's own CPU time does not count against it: past
// it the call ends with status 2. Time the process waits (swap, the scheduler, a blocked host
// call) does not count, while an infinite loop does, since it spends CPU. A call made while
// another runs (from inside a host call) has a budget of its own. The runtime has a memory limit;
// running out ends the call with an error. QuickJS measures its stack from where a call came in
// on it, since the core may call from an async function's fiber (512 KB in scriptc, its last
// 128 KB kept for the overflow guard), not only from the main
// stack: the first call, and one made during a host call from another stack (a hook fired inside
// an async function), measure from where they are, and the host call puts the caller's limit back
// when it returns. A plugin recursing past WCJS_STACK (about 230 calls deep, a QuickJS frame taking
// about 1.1 KB) gets a RangeError it can catch.
//
// A plugin may be ES modules: the core registers each of its files (`wcjs_add_module`, by its
// absolute path) and evaluates its entry (`wcjs_eval_module`). A relative import resolves against
// the importing file's folder and loads only a registered file, so a plugin reaches nothing the
// core did not hand it; a bare specifier is an error. QuickJS keeps a module by its name, so the
// core names an entry with a generation (`/p/index.js#2`): the files it imports carry the same
// suffix and are compiled again, from the sources registered now.
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "quickjs.h"

typedef int32_t (*wcjs_host_cb)(const uint8_t *name, size_t name_len, const uint8_t *args, size_t args_len, void *context);
typedef void (*wcjs_result_cb)(int32_t status, const uint8_t *text, size_t len, void *context);

#define WCJS_DEPTH 64
#define WCJS_STACK (256 * 1024)
/** The host CPU time one call may exclude from its budget; past it, the budget runs. */
#define WCJS_HOST_MAX 5000

/** A file a plugin may import: its absolute path and its source. */
typedef struct wcjs_module {
  char *name;
  char *code;
  size_t len;
  struct wcjs_module *next;
} wcjs_module;

typedef struct {
  JSRuntime *rt;
  JSContext *ctx;
  wcjs_host_cb host;
  void *host_context;
  char *reply[WCJS_DEPTH];
  size_t reply_len[WCJS_DEPTH];
  int depth;
  int entered;
  int32_t budget_ms;
  int64_t deadline_ms;
  /** Host CPU time excluded from this call's budget, and an unhandled rejection waiting to be reported. */
  int64_t host_ms;
  char *rejection;
  int interrupted;
  /** The stack QuickJS measures now, as the shim sees it: where it was measured from, and its limit. */
  uintptr_t stack_top;
  uintptr_t stack_limit;
  /** The files plugins may import. */
  wcjs_module *modules;
} wcjs;

/** The length of `name` without its generation (`#…`). */
static size_t plain_len(const char *name) {
  const char *hash = strchr(name, '#');
  return hash != NULL ? (size_t)(hash - name) : strlen(name);
}

/** `name` relative to the folder of `base` (`./x`, `../x`), its `.` and `..` segments resolved, with `base`'s generation; anything else as it is. */
static char *wcjs_normalize(JSContext *ctx, const char *base, const char *name, void *opaque) {
  (void)opaque;
  if (name[0] != '.') return js_strdup(ctx, name);
  size_t base_len = plain_len(base);
  const char *suffix = base + base_len;
  size_t dir_len = base_len;
  while (dir_len > 0 && base[dir_len - 1] != '/') dir_len--;
  size_t name_len = strlen(name);
  size_t cap = dir_len + name_len + strlen(suffix) + 2;
  char *joined = (char *)js_malloc(ctx, cap);
  char *out = (char *)js_malloc(ctx, cap);
  if (joined == NULL || out == NULL) {
    js_free(ctx, joined);
    js_free(ctx, out);
    return NULL;
  }
  memcpy(joined, base, dir_len);
  memcpy(joined + dir_len, name, name_len);
  joined[dir_len + name_len] = 0;
  // Resolve the segments: "." goes, ".." drops the segment before it.
  size_t o = 0;
  const char *p = joined;
  while (*p != 0) {
    const char *end = strchr(p, '/');
    size_t seg = end != NULL ? (size_t)(end - p) : strlen(p);
    if (seg == 1 && p[0] == '.') {
      // nothing
    } else if (seg == 2 && p[0] == '.' && p[1] == '.') {
      if (o > 0) o--;
      while (o > 0 && out[o - 1] != '/') o--;
    } else if (seg > 0 || o == 0) {
      memcpy(out + o, p, seg);
      o += seg;
      if (end != NULL) out[o++] = '/';
    }
    if (end == NULL) break;
    p = end + 1;
  }
  out[o] = 0;
  if (out[0] != '/' && joined[0] == '/') {
    memmove(out + 1, out, o + 1);
    out[0] = '/';
    o++;
  }
  strcpy(out + o, suffix);
  js_free(ctx, joined);
  return out;
}

/** Compile the registered file `name` names (its generation kept in the module's name); an error for one not registered. */
static JSModuleDef *wcjs_load(JSContext *ctx, const char *name, void *opaque) {
  wcjs *w = (wcjs *)opaque;
  size_t len = plain_len(name);
  wcjs_module *m = w->modules;
  while (m != NULL && !(strlen(m->name) == len && memcmp(m->name, name, len) == 0)) m = m->next;
  if (m == NULL) {
    JS_ThrowReferenceError(ctx, "plugins: cannot import %.*s: not a file of the plugin", (int)len, name);
    return NULL;
  }
  JSValue fn = JS_Eval(ctx, m->code, m->len, name, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
  if (JS_IsException(fn)) return NULL;
  JSModuleDef *def = (JSModuleDef *)JS_VALUE_GET_PTR(fn);
  JS_FreeValue(ctx, fn);
  return def;
}

static int64_t cpu_ms(void) {
  struct timespec ts;
  clock_gettime(CLOCK_THREAD_CPUTIME_ID, &ts);
  return (int64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static int on_interrupt(JSRuntime *rt, void *opaque) {
  (void)rt;
  wcjs *w = (wcjs *)opaque;
  if (w->deadline_ms > 0 && cpu_ms() > w->deadline_ms) {
    w->interrupted = 1;
    return 1;
  }
  return 0;
}

/** A promise rejected with no handler: keep its reason for the jobs pump to report. */
static void on_rejection(JSContext *ctx, JSValueConst promise, JSValueConst reason, bool is_handled, void *opaque) {
  (void)promise;
  wcjs *w = (wcjs *)opaque;
  if (is_handled) {
    free(w->rejection);
    w->rejection = NULL;
    return;
  }
  if (w->rejection != NULL) return;
  const char *text = JS_ToCString(ctx, reason);
  if (text == NULL) return;
  size_t len = strlen(text);
  w->rejection = (char *)malloc(len + 1);
  if (w->rejection != NULL) {
    memcpy(w->rejection, text, len);
    w->rejection[len] = 0;
  }
  JS_FreeCString(ctx, text);
}

/** Measure QuickJS's stack from here: the first call in, or one from another stack (an async function's fiber). */
static void measure(wcjs *w) {
  uintptr_t sp = (uintptr_t)__builtin_frame_address(0);
  JS_UpdateStackTop(w->rt);
  JS_SetMaxStackSize(w->rt, WCJS_STACK);
  w->stack_top = sp;
  w->stack_limit = sp - WCJS_STACK;
}

/** Back to the stack measured before a host call that called into JS from another one: the same limit, from here. */
static void remeasure(wcjs *w, uintptr_t top, uintptr_t limit) {
  uintptr_t sp = (uintptr_t)__builtin_frame_address(0);
  JS_UpdateStackTop(w->rt);
  JS_SetMaxStackSize(w->rt, sp > limit ? sp - limit : 1);
  w->stack_top = top;
  w->stack_limit = limit;
}

static JSValue js_host(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  (void)this_val;
  wcjs *w = (wcjs *)JS_GetContextOpaque(ctx);
  if (w->host == NULL) return JS_ThrowInternalError(ctx, "plugins: no host");
  if (w->depth >= WCJS_DEPTH - 1) return JS_ThrowInternalError(ctx, "plugins: host calls nested too deep");
  size_t name_len = 0, args_len = 0;
  const char *name = JS_ToCStringLen(ctx, &name_len, argv[0]);
  if (name == NULL) return JS_EXCEPTION;
  const char *args = argc > 1 ? JS_ToCStringLen(ctx, &args_len, argv[1]) : NULL;
  // An argument that could not be converted (out of memory) is the plugin's error, never an empty call.
  if (argc > 1 && args == NULL) {
    JS_FreeCString(ctx, name);
    return JS_EXCEPTION;
  }
  int d = ++w->depth;
  w->reply[d] = NULL;
  w->reply_len[d] = 0;
  // The host's CPU time is not the plugin's: the deadline moves by as long as the host took.
  int64_t started = cpu_ms();
  uintptr_t top = w->stack_top, limit = w->stack_limit;
  int32_t status = w->host((const uint8_t *)name, name_len, (const uint8_t *)(args != NULL ? args : ""), args != NULL ? args_len : 0, w->host_context);
  if (w->stack_top != top) remeasure(w, top, limit);
  if (w->deadline_ms > 0) {
    int64_t took = cpu_ms() - started;
    int64_t room = WCJS_HOST_MAX - w->host_ms;
    if (room > 0) w->deadline_ms += took < room ? took : room;
    w->host_ms += took;
  }
  JS_FreeCString(ctx, name);
  if (args != NULL) JS_FreeCString(ctx, args);
  JSValue out;
  if (status != 0) out = JS_ThrowInternalError(ctx, "%.*s", (int)w->reply_len[d], w->reply[d] != NULL ? w->reply[d] : "");
  else if (w->reply[d] != NULL) out = JS_NewStringLen(ctx, w->reply[d], w->reply_len[d]);
  else out = JS_NewStringLen(ctx, "null", 4);
  free(w->reply[d]);
  w->reply[d] = NULL;
  w->depth--;
  return out;
}

/** The budget the next calls into JS start with (an agent's history read gets a longer one, then the usual back). */
void wcjs_set_budget(void *ctx, int32_t budget_ms) {
  wcjs *w = (wcjs *)ctx;
  w->budget_ms = budget_ms;
}

void *wcjs_new(int32_t memory_mb, int32_t budget_ms) {
  wcjs *w = (wcjs *)calloc(1, sizeof(wcjs));
  if (w == NULL) return NULL;
  w->rt = JS_NewRuntime();
  JS_SetMemoryLimit(w->rt, (size_t)memory_mb * 1024 * 1024);
  JS_SetMaxStackSize(w->rt, WCJS_STACK);
  JS_SetInterruptHandler(w->rt, on_interrupt, w);
  w->ctx = JS_NewContext(w->rt);
  JS_SetContextOpaque(w->ctx, w);
  w->budget_ms = budget_ms;
  JS_SetHostPromiseRejectionTracker(w->rt, on_rejection, w);
  JS_SetModuleLoaderFunc(w->rt, wcjs_normalize, wcjs_load, w);
  JSValue global = JS_GetGlobalObject(w->ctx);
  JS_SetPropertyStr(w->ctx, global, "__host", JS_NewCFunction(w->ctx, js_host, "__host", 2));
  JS_FreeValue(w->ctx, global);
  return w;
}

void wcjs_free(void *p) {
  wcjs *w = (wcjs *)p;
  if (w == NULL) return;
  JS_FreeContext(w->ctx);
  JS_FreeRuntime(w->rt);
  free(w->rejection);
  wcjs_module *m = w->modules;
  while (m != NULL) {
    wcjs_module *next = m->next;
    free(m->name);
    free(m->code);
    free(m);
    m = next;
  }
  free(w);
}

void wcjs_set_host(void *p, wcjs_host_cb host, void *context) {
  wcjs *w = (wcjs *)p;
  w->host = host;
  w->host_context = context;
}

/** The answer to the host call in progress (its JSON text, or an error's message when the callback returns nonzero). */
void wcjs_reply(void *p, const uint8_t *text, size_t len) {
  wcjs *w = (wcjs *)p;
  int d = w->depth;
  if (d <= 0) return;
  free(w->reply[d]);
  w->reply[d] = (char *)malloc(len + 1);
  if (w->reply[d] == NULL) {
    w->reply_len[d] = 0;
    return;
  }
  memcpy(w->reply[d], text, len);
  w->reply[d][len] = 0;
  w->reply_len[d] = len;
}

/** The caller's budget, put back when a call into JS ends. */
typedef struct {
  int64_t deadline_ms;
  int64_t host_ms;
  int interrupted;
} wcjs_budget;

/** A call into JS starts with a budget of its own: one made from inside a host call (a plugin running another's command) is that plugin's, and its caller's deadline moves by the host's CPU time. */
static wcjs_budget enter(wcjs *w) {
  wcjs_budget saved = {w->deadline_ms, w->host_ms, w->interrupted};
  uintptr_t sp = (uintptr_t)__builtin_frame_address(0);
  if (w->entered++ == 0 || sp > w->stack_top || sp < w->stack_limit) measure(w);
  w->interrupted = 0;
  w->host_ms = 0;
  w->deadline_ms = w->budget_ms > 0 ? cpu_ms() + w->budget_ms : 0;
  return saved;
}

static void leave(wcjs *w, wcjs_budget saved) {
  w->entered--;
  w->deadline_ms = saved.deadline_ms;
  w->host_ms = saved.host_ms;
  w->interrupted = saved.interrupted;
}

/** Hand `v` to `done`: status 0 and its text (a string as is, anything else as JSON), 1 and an error's message and stack, 2 when the budget ran out. Frees `v`. */
static int32_t deliver(wcjs *w, JSValue v, wcjs_result_cb done, void *context) {
  JSContext *ctx = w->ctx;
  int32_t status = 0;
  JSValue shown;
  if (JS_IsException(v)) {
    status = w->interrupted ? 2 : 1;
    JSValue err = JS_GetException(ctx);
    JSValue stack = JS_IsError(err) ? JS_GetPropertyStr(ctx, err, "stack") : JS_UNDEFINED;
    const char *message = JS_ToCString(ctx, err);
    const char *trace = JS_IsString(stack) ? JS_ToCString(ctx, stack) : NULL;
    // Out of memory, QuickJS may not manage to make the message's text at all.
    const char *fallback = status == 2 ? "plugins: the plugin ran past its time budget" : "plugins: the plugin failed (out of memory?)";
    if (message == NULL) message = JS_ToCString(ctx, JS_NewString(ctx, fallback));
    size_t mlen = message != NULL ? strlen(message) : 0;
    size_t tlen = trace != NULL ? strlen(trace) : 0;
    char *text = (char *)malloc(mlen + tlen + 2);
    if (text != NULL) {
      memcpy(text, message != NULL ? message : "", mlen);
      text[mlen] = '\n';
      memcpy(text + mlen + 1, trace != NULL ? trace : "", tlen);
      text[mlen + 1 + tlen] = 0;
      done(status, (const uint8_t *)text, mlen + 1 + tlen, context);
      free(text);
    }
    if (message != NULL) JS_FreeCString(ctx, message);
    if (trace != NULL) JS_FreeCString(ctx, trace);
    JS_FreeValue(ctx, stack);
    JS_FreeValue(ctx, err);
    JS_RunGC(w->rt);
    return status;
  }
  shown = JS_IsString(v) ? JS_DupValue(ctx, v) : JS_JSONStringify(ctx, v, JS_UNDEFINED, JS_UNDEFINED);
  JS_FreeValue(ctx, v);
  if (JS_IsException(shown)) {
    // A value JSON cannot write (a cycle, a BigInt): the plugin's error, not "null".
    JSValue err = JS_GetException(ctx);
    const char *message = JS_ToCString(ctx, err);
    const char *fallback = "plugins: the plugin's value cannot be written as JSON";
    done(1, (const uint8_t *)(message != NULL ? message : fallback), message != NULL ? strlen(message) : strlen(fallback), context);
    if (message != NULL) JS_FreeCString(ctx, message);
    JS_FreeValue(ctx, err);
    JS_FreeValue(ctx, shown);
    return 1;
  }
  size_t len = 0;
  const char *text = JS_IsUndefined(shown) ? NULL : JS_ToCStringLen(ctx, &len, shown);
  done(status, (const uint8_t *)(text != NULL ? text : "null"), text != NULL ? len : 4, context);
  if (text != NULL) JS_FreeCString(ctx, text);
  JS_FreeValue(ctx, shown);
  return status;
}

/** Evaluate `code` as a script named `file`. */
int32_t wcjs_eval(void *p, const uint8_t *code, size_t code_len, const uint8_t *file, size_t file_len, wcjs_result_cb done, void *context) {
  wcjs *w = (wcjs *)p;
  char *src = (char *)malloc(code_len + 1);
  char *name = (char *)malloc(file_len + 1);
  if (src == NULL || name == NULL) {
    free(src);
    free(name);
    return 1;
  }
  memcpy(src, code, code_len);
  src[code_len] = 0;
  memcpy(name, file, file_len);
  name[file_len] = 0;
  wcjs_budget saved = enter(w);
  JSValue v = JS_Eval(w->ctx, src, code_len, name, JS_EVAL_TYPE_GLOBAL);
  int32_t status = deliver(w, v, done, context);
  leave(w, saved);
  free(src);
  free(name);
  return status;
}

/** Register (or replace) the file at absolute path `name` with source `code`, for a plugin's imports. */
void wcjs_add_module(void *p, const uint8_t *name, size_t name_len, const uint8_t *code, size_t code_len) {
  wcjs *w = (wcjs *)p;
  wcjs_module *m = w->modules;
  while (m != NULL && !(strlen(m->name) == name_len && memcmp(m->name, name, name_len) == 0)) m = m->next;
  char *text = (char *)malloc(code_len + 1);
  if (text == NULL) return;
  memcpy(text, code, code_len);
  text[code_len] = 0;
  if (m != NULL) {
    free(m->code);
    m->code = text;
    m->len = code_len;
    return;
  }
  m = (wcjs_module *)calloc(1, sizeof(wcjs_module));
  char *key = (char *)malloc(name_len + 1);
  if (m == NULL || key == NULL) {
    free(m);
    free(key);
    free(text);
    return;
  }
  memcpy(key, name, name_len);
  key[name_len] = 0;
  m->name = key;
  m->code = text;
  m->len = code_len;
  m->next = w->modules;
  w->modules = m;
}

/**
 * Evaluate `code` as the ES module named `file` (a plugin's entry): its imports load the registered
 * files, its body runs, and the promise jobs it starts run before the result (a module that awaits
 * at its top level settles then). A module that throws, or whose evaluation rejects, is an error.
 */
int32_t wcjs_eval_module(void *p, const uint8_t *code, size_t code_len, const uint8_t *file, size_t file_len, wcjs_result_cb done, void *context) {
  wcjs *w = (wcjs *)p;
  JSContext *ctx = w->ctx;
  char *src = (char *)malloc(code_len + 1);
  char *name = (char *)malloc(file_len + 1);
  if (src == NULL || name == NULL) {
    free(src);
    free(name);
    return 1;
  }
  memcpy(src, code, code_len);
  src[code_len] = 0;
  memcpy(name, file, file_len);
  name[file_len] = 0;
  wcjs_budget saved = enter(w);
  JSValue v = JS_Eval(ctx, src, code_len, name, JS_EVAL_TYPE_MODULE);
  if (!JS_IsException(v)) {
    for (;;) {
      JSContext *job_ctx = NULL;
      if (JS_ExecutePendingJob(w->rt, &job_ctx) <= 0) break;
    }
    JSPromiseStateEnum state = JS_PromiseState(ctx, v);
    if (state == JS_PROMISE_REJECTED) {
      JSValue reason = JS_PromiseResult(ctx, v);
      JS_FreeValue(ctx, v);
      v = JS_Throw(ctx, reason);
      // Delivered here as the module's error, not again as an unhandled rejection.
      free(w->rejection);
      w->rejection = NULL;
    } else {
      JS_FreeValue(ctx, v);
      v = JS_NULL;
    }
  }
  int32_t status = deliver(w, v, done, context);
  leave(w, saved);
  free(src);
  free(name);
  return status;
}

/** Call the plugins' `__invoke(id, json)`. */
int32_t wcjs_invoke(void *p, int32_t id, const uint8_t *json, size_t len, wcjs_result_cb done, void *context) {
  wcjs *w = (wcjs *)p;
  JSContext *ctx = w->ctx;
  JSValue global = JS_GetGlobalObject(ctx);
  JSValue fn = JS_GetPropertyStr(ctx, global, "__invoke");
  JS_FreeValue(ctx, global);
  if (!JS_IsFunction(ctx, fn)) {
    JS_FreeValue(ctx, fn);
    const char *msg = "plugins: __invoke is not defined";
    done(1, (const uint8_t *)msg, strlen(msg), context);
    return 1;
  }
  JSValue args[2] = {JS_NewInt32(ctx, id), JS_NewStringLen(ctx, (const char *)json, len)};
  wcjs_budget saved = enter(w);
  JSValue v = JS_Call(ctx, fn, JS_UNDEFINED, 2, args);
  int32_t status = deliver(w, v, done, context);
  leave(w, saved);
  JS_FreeValue(ctx, args[0]);
  JS_FreeValue(ctx, args[1]);
  JS_FreeValue(ctx, fn);
  return status;
}

/** Run the pending promise jobs; each that throws is handed to `done`. Answers how many ran. */
int32_t wcjs_jobs(void *p, wcjs_result_cb done, void *context) {
  wcjs *w = (wcjs *)p;
  int32_t ran = 0;
  // One deadline for the whole pump: a job cannot get a fresh budget by awaiting the next one.
  wcjs_budget saved = enter(w);
  for (;;) {
    JSContext *job_ctx = NULL;
    int r = JS_ExecutePendingJob(w->rt, &job_ctx);
    if (r < 0) deliver(w, JS_EXCEPTION, done, context);
    if (r <= 0) break;
    ran++;
  }
  JS_RunGC(w->rt);
  leave(w, saved);
  if (w->rejection != NULL) {
    char *text = w->rejection;
    w->rejection = NULL;
    done(1, (const uint8_t *)text, strlen(text), context);
    free(text);
  }
  return ran;
}
