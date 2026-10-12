/**
 * @bootstrapp/light/html/index.js: the browser entry of the renderer. It
 * installs the DOM host and re-exports the renderer-agnostic API from
 * `core.js` together with the browser-only adoption and slot helpers.
 */

import { DomHost } from "../dom/host.js";
import { setHost } from "./host.js";

setHost(new DomHost());

export * from "./core.js";
export { ASSIGNED_ATTR, SlotPart, UNSLOTTED_TAG, isMoving, projectSlots, unprojectUnits } from "./slots.js";
export { topLevelPair } from "./adopt.js";
