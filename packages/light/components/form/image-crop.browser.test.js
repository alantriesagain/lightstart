import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: cropDef } = await import("./image-crop.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const RED = [220, 20, 20];
const BLUE = [20, 20, 220];

const picture = async (width = 1200, height = 800, split = 600) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  context.fillStyle = `rgb(${RED})`;
  context.fillRect(0, 0, split, height);
  context.fillStyle = `rgb(${BLUE})`;
  context.fillRect(split, 0, width - split, height);
  return /** @type {Blob} */ (await new Promise((resolve) => canvas.toBlob(resolve, "image/png")));
};

const pixel = async (/** @type {Blob} */ blob, /** @type {number} */ x, /** @type {number} */ y) => {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  context.drawImage(bitmap, 0, 0);
  return [...context.getImageData(x, y, 1, 1).data.slice(0, 3)];
};

const close = (/** @type {number[]} */ got, /** @type {number[]} */ want, label = "") =>
  assert.ok(got.every((v, i) => Math.abs(v - want[i]) < 40), `${label} ${got} is not near ${want}`);

/** @type {Element[]} */
const mounted = [];

const mount = async (props = {}) => {
  const el = document.createElement("lc-image-crop");
  Object.assign(el, props);
  const host = document.createElement("div");
  host.style.width = "300px";
  host.append(el);
  document.body.append(host);
  mounted.push(host);
  await tick();
  await el.$requestUpdate();
  await tick();
  return el;
};

const events = (el) => {
  /** @type {Array<{ type: string, detail: unknown }>} */
  const seen = [];
  for (const type of ["loadstart", "load", "change", "error"])
    el.addEventListener(type, (/** @type {CustomEvent} */ e) => seen.push({ type, detail: e.detail }));
  return seen;
};

describe("@bootstrapp/light - lc-image-crop", () => {
  before(async () => {
    if (!customElements.get("lc-image-crop")) View.define("lc-image-crop", cropDef);
    const style = document.createElement("style");
    style.textContent = await (await fetch(new URL("./image-crop.css", import.meta.url))).text();
    document.head.append(style);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("waits empty for a photo, and picking opens the chooser inside the tap", async () => {
    const el = await mount();
    assert.equal(el.status, "empty");
    assert.ok(el.querySelector("[data-choose]"));
    assert.equal(await el.toBlob(), null);
    const input = el.querySelector(".image-crop-input");
    let opened = 0;
    input.click = () => { opened++; };
    el.querySelector("[data-choose]").click();
    assert.equal(opened, 1);
  });

  it("opens a picture zoomed out to cover the frame, saying so as it goes", async () => {
    const el = await mount();
    const seen = events(el);
    assert.equal(await el.load(await picture()), true);
    await el.$requestUpdate();
    assert.deepEqual(seen.map((e) => e.type), ["loadstart", "load"]);
    assert.deepEqual(seen[1].detail, { width: 1200, height: 800 });
    assert.equal(el.status, "ready");
    assert.equal(el.zoom, 1);
    assert.ok(el.querySelector(".image-crop-mask"), "the circle shows what a round photo keeps");
  });

  it("answers the middle square as a small square image", async () => {
    const el = await mount();
    await el.load(await picture());
    const blob = await el.toBlob();
    assert.ok(blob);
    assert.equal(blob.type, "image/webp");
    assert.ok(blob.size <= 150000);
    const bitmap = await createImageBitmap(blob);
    assert.deepEqual([bitmap.width, bitmap.height], [512, 512]);
    close(await pixel(blob, 100, 256), RED, "left of the middle");
    close(await pixel(blob, 412, 256), BLUE, "right of the middle");
  });

  it("moves the picture with a drag, and stops at its edge", async () => {
    const el = await mount();
    await el.load(await picture());
    const frame = el.querySelector(".image-crop-frame");
    const at = (/** @type {string} */ type, /** @type {number} */ x) =>
      (type === "pointerdown" ? frame : window).dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: "mouse", button: 0, clientX: x, clientY: 100, bubbles: true, cancelable: true }));
    const seen = events(el);
    at("pointerdown", 10);
    at("pointermove", 160);
    at("pointerup", 160);
    close(await pixel(await el.toBlob(), 350, 256), RED, "dragged right, more of the left shows");
    assert.deepEqual(seen.map((e) => e.type), ["change"], "one change when the finger lifts");
    at("pointerdown", 10);
    at("pointermove", 2000);
    at("pointerup", 2000);
    close(await pixel(await el.toBlob(), 10, 256), RED, "and the picture's edge stays at the frame's");
  });

  it("zooms about the pointer with a wheel, and with the keys", async () => {
    const el = await mount();
    await el.load(await picture());
    const frame = el.querySelector(".image-crop-frame");
    const box = frame.getBoundingClientRect();
    frame.dispatchEvent(new WheelEvent("wheel", { deltaY: -200, clientX: box.left + 150, clientY: box.top + 150, bubbles: true, cancelable: true }));
    assert.ok(el.zoom > 1);
    frame.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true }));
    assert.equal(el.zoom, 1, "0 opens it out again");
    frame.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true }));
    assert.ok(Math.abs(el.zoom - 1.2) < 1e-9);
    for (let i = 0; i < 20; i++) frame.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true }));
    assert.equal(el.zoom, 4, "and never past maxZoom");
  });

  it("says a picture it cannot open cannot be opened, and offers another go", async () => {
    const el = await mount();
    const seen = events(el);
    assert.equal(await el.load(new Blob(["not a picture"], { type: "image/heic" })), false);
    await el.$requestUpdate();
    assert.equal(el.status, "error");
    assert.equal(seen.at(-1)?.type, "error");
    assert.match(el.error, /JPEG/);
    assert.ok(el.querySelector(".image-crop-again"));
  });

  it("answers nothing when no quality brings it under the limit, and the type asked for", async () => {
    const el = await mount({ maxBytes: 10 });
    await el.load(await picture());
    assert.equal(await el.toBlob(), null);
    el.maxBytes = 150000;
    el.outputType = "image/jpeg";
    el.outputSize = 256;
    const blob = await el.toBlob();
    assert.equal(blob?.type, "image/jpeg");
    assert.deepEqual([(await createImageBitmap(blob)).width], [256]);
  });

  it("lets the picture go on clear, and keeps the file input's own change to itself", async () => {
    const el = await mount();
    await el.load(await picture());
    const seen = events(el);
    el.querySelector(".image-crop-input").dispatchEvent(new Event("change", { bubbles: true }));
    assert.deepEqual(seen, [], "a host listening for change hears only the crop");
    el.clear();
    await el.$requestUpdate();
    assert.equal(el.status, "empty");
    assert.equal(await el.toBlob(), null);
  });
});
