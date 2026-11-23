/**
 * @lightstart/camera app bootstrap helper. Light has no extension boot, so an
 * app calls `openCameraLink()` once from its own startup: when the page's
 * fragment holds a `#cam=` pairing payload it mounts `<camera-link>` over the
 * page, which makes this phone the other phone's camera.
 */

import View from "@lightstart/light";
import screen from "./views/link.js";
import { decodePair } from "./lib/pair.js";

/**
 * Mount `<camera-link>` when the URL fragment holds a camera link, and answer
 * whether it did. The link view's module defines the tag if the generation did
 * not, so an app that only boots from the hash still gets a working element.
 * @returns {boolean}
 */
export const openCameraLink = () => {
  const hash = globalThis.location?.hash ?? "";
  if (!decodePair(hash)) return false;
  if (!customElements.get("camera-link")) View.define(screen);
  if (!document.querySelector("camera-link")) document.body.appendChild(document.createElement("camera-link"));
  return true;
};
