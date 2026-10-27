/**
 * @lightstart/light/controller: shared app state, and what binds to it
 * `defineController` and its mixins, naming controllers as sync targets, the
 * adapter, sync-type and binder registries, and the host's hooks. Everything
 * here is loaded by `defineController` anyway; the adapters, `resource()` and
 * the view plugin are their own entries (`/controller/storage`, `/document`,
 * `/url`, `/resource`, `/view`), loaded only by what imports them.
 */

export { defineController, defineMixin, nameControllers } from "./define.js";
export { registerAdapter, registerSyncType, registerSyncBinder, getAdapter, pendingAdapterNames } from "./sync.js";
export { configureControllers } from "./config.js";
