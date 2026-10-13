/**
 * @bootstrapp/light/controller/view: the sync plugin
 * `View.use(syncPlugin)` makes a component property declared with `sync:`
 * follow its target, through the same binding a controller uses: an adapter
 * or controller name, a store, a signal, a controller, or a target a sync
 * binder claims. The binding is made when the element connects and its unbind
 * rides the element's own teardowns. A synced property takes its value from
 * the target, so markup neither sets nor reflects it; a component with a
 * `query`-backed property also gets `dataPending`, which the binder that reads
 * the query keeps current.
 */

import T from "../types/index.js";
import { bindProperty } from "./sync.js";

/** @import { PropertiesSchema, ViewPlugin } from "../view/types.ts" */
/** @import { SyncProp } from "./types.ts" */

/**
 * @param {PropertiesSchema} properties
 * @returns {PropertiesSchema}
 */
const syncedProperties = (properties) => {
  const entries = Object.entries(properties);
  if (!entries.some(([, prop]) => prop.sync)) return properties;
  const next = Object.fromEntries(entries.map(([key, prop]) => [key, prop.sync ? { ...prop, attribute: false } : prop]));
  if (!next.dataPending && entries.some(([, prop]) => prop.sync && prop.query)) next.dataPending = T.boolean({ defaultValue: false });
  return next;
};

/** @type {ViewPlugin} */
export const syncPlugin = {
  name: "syncProps",
  props: syncedProperties,
  test: ({ component }) => Object.values(component.properties || {}).some((prop) => prop.sync),
  events: {
    connected: ({ instance, component }) => {
      const host = /** @type {Record<string, any>} */ (/** @type {unknown} */ (instance));
      instance.$own(Object.entries(component.properties || {})
        .filter(([, prop]) => prop.sync)
        .map(([key, prop]) => bindProperty({ store: instance.$state, key, prop: /** @type {SyncProp} */ (prop), host }).unbind));
    },
  },
};
