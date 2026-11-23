import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import View from "@lightstart/light";
import previewDef from "../views/preview.js";

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

/** @template T @param {() => T | null | undefined} get @param {string} what @returns {Promise<T>} */
const until = async (get, what) => {
  for (let i = 0; i < 120; i++) {
    const found = get();
    if (found) return found;
    await frame();
  }
  throw new Error(`timed out waiting for ${what}`);
};

/** @type {HTMLElement[]} */
const mounted = [];

/** @param {Record<string, unknown>} props */
const mount = (props) => {
  if (!customElements.get("camera-preview")) View.define("camera-preview", previewDef);
  const el = document.createElement("camera-preview");
  Object.assign(el, { fit: "cover", ...props });
  document.body.appendChild(el);
  mounted.push(el);
  return /** @type {HTMLElement & { stream: MediaStream | null }} */ (el);
};

after(() => {
  for (const el of mounted.splice(0)) el.remove();
});

describe("camera-preview", () => {
  it("draws a video and gives it the stream", async () => {
    const stream = new MediaStream();
    const el = mount({ stream });
    const video = await until(() => /** @type {HTMLVideoElement | null} */ (el.querySelector("video.cam-preview-video")), "the video");
    await frame();
    assert.equal(video.tagName, "VIDEO");
    assert.equal(video.srcObject, stream);
    assert.equal(video.muted, true);
  });

  it("swaps the stream when the property changes", async () => {
    const el = mount({ stream: new MediaStream() });
    const video = await until(() => /** @type {HTMLVideoElement | null} */ (el.querySelector("video.cam-preview-video")), "the video");
    await frame();
    const next = new MediaStream();
    el.stream = next;
    await frame();
    await frame();
    assert.equal(video.srcObject, next);
  });
});
