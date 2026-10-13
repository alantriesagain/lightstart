---
name: add-controller
description: Add a controller that owns state, model writes and IO, with its browser test
user_invocable: true
---

<!-- Managed by Bootstrapp: generated from bootstrapp/controller/skills/add-controller.md. Edit the source, then run `bootstrapp types`. -->

# Add a controller

A controller is a named piece of app state and the methods that change it, shared at runtime by every component that uses it. There is one per name per app, built on first reach and reset by `dispose()`; it is never scoped (one per document is a keyed collection inside one controller). Every `$APP.Model` write, every rule, every piece of state shared beyond one component goes in a `defineController` file under `controllers/`. If you are unsure whether a piece belongs here, in a mixin, in `lib/` or in the view, read the "choosing a citizen" section of `framework/README.md` first.

## Steps

1. **Scaffold**: `bootstrapp new:controller <name> --props "count:number"` writes `controllers/<name>.js`. Registration is automatic: `$APP.<name>.<member>` works everywhere, and the controller is built on first reach. Read `$APP` inside the function that uses it, never into a module-scope binding.
2. **Declare every instance field**: reactive state in `props` as plain defaults (a JSDoc cast where the literal says too little), bindings in the `sync` block, plain fields (an interval id, a resource, an audio engine) as members beside the methods (`controller/declare-instance-surface`).
3. **Own the teardown**: every subscription or disposable made in `connected()` goes through `this.$own(...)`; `connected()` may be async and returns the work it starts.
4. **Write the browser test in the same commit**: `tests/app-<name>.browser.test.js` booting the real app (`controller/controller-has-test`).
5. `bootstrapp types` so `$APP.<name>` is typed from the casts and the JSDoc on the methods.

## Shape

```js
import { defineController } from "@bootstrapp/light/controller";
import $APP from "bootstrapp";

/** @import { Row, TaskRecord } from "../types.ts" */

export default defineController({
  name: "tasks",
  props: {
    filter: /** @type {"all" | "open" | "done"} */ ("all"),
    rows: /** @type {Row<TaskRecord>[]} */ ([]),
  },
  sync: { filter: "local", rows: { to: $APP.Model.task, query: { order: "-createdAt", fields: ["id", "title", "done"] } } },
  _undo: /** @type {Row<TaskRecord> | null} */ (null),
  /** @param {string} title */
  async add(title) {
    return $APP.Model.task.add({ title, done: false, createdAt: new Date().toISOString() });
  },
});
```

## Rules

- Framework members are `$`-prefixed (`$name`, `$state`, `$sync`, `$queries`, `$own`, `$attach`, `$ready`, `$dispose`); a `$`-prefixed property or member throws at define time, and so do `definition`, `has`, `dispose`, `get` and `create`. Every other name is free, `state`, `config`, `ready`, `connected` and `name` included.
- Every controller is a `sync:` target for views by its name (`sync: "tasks"`, property names must match). `defineController` refuses `adapter:`, a `reactive: false` prop and a sync option inside a `T` descriptor, naming the form that replaced each.
- A controller too large for one literal is composed: `mixins: [withUndo, withAutosave({ delay })]`, each a `defineMixin({ props, sync, ...members })` from `@bootstrapp/light/controller` imported from the module that defines it. Fragments fold in first, the definition wins a collision, hooks chain mixin-first, sync entries union, and the generated `$APP.<name>` type carries every fragment's members.
- Rows a controller mirrors are a prop bound to the model in the sync block (live, no refresh after writes; in a package the target is a thunk, `to: () => $APP.Model.task`); other async goes through `resource()` from `@bootstrapp/light/controller/resource`.
- Small persisted state is a prop bound to `"local"` in the sync block; strings are stored raw, everything else as JSON.
- Members that are arrays, plain objects, `Map` or `Set` are copied per instance; anything that has to be built per instance (a `WeakMap`, a value read from `$APP`) is declared with a cast and assigned in `connected()`.
- A timer uses `Date.now()` as its time source and keeps the resumable handle in a prop bound to `"local"` so a reload rebuilds it; the interval id is a member stopped in `this.$own(() => ...)`.
- The controller is light's (`light/controller/README.md`); `bootstrapp/controller` adds `registerControllers` (`framework/controller/README.md`), and binding to the model is `bootstrapp/model/binder` (`framework/model/README.md`).
- Reference: `projects/bboxe/controllers/timer.js` (timer, resumable handle, wake lock), `projects/bboxe/controllers/library.js` (model-bound props), `examples/centavo/controllers/rates.js` (`resource()`).
