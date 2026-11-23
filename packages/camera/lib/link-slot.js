/**
 * The `cameraLink` slot the link backend reads. The controller installs its
 * handle here so `createCamera({ source: { kind: "link" } })` reaches it
 * without the camera entry importing the controller and closing a cycle.
 */

/** @type {(() => import("../types.ts").CameraLinkSlot | undefined) | null} */
let current = null;

/**
 * @param {() => import("../types.ts").CameraLinkSlot | undefined} slot
 * @returns {void}
 */
export const setLinkSlot = (slot) => {
  current = slot;
};

/** @returns {import("../types.ts").CameraLinkSlot | undefined} */
export const linkSlot = () => current?.();
