import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import maps from "../controllers/maps.js";
import { html } from "@lightstart/light/html";
import View from "@lightstart/light";
import mapsViewDef from "../views/view.js";

const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

const loadSheet = () => {
  const sheet = document.createElement("link");
  sheet.rel = "stylesheet";
  sheet.href = new URL("../views/view.css", import.meta.url).href;
  const loaded = new Promise((resolve) => { sheet.onload = resolve; sheet.onerror = resolve; });
  document.head.append(sheet);
  return loaded;
};

/**
 * @template T
 * @param {() => T | null | undefined} get
 * @param {string} what
 * @returns {Promise<T>}
 */
const until = async (get, what) => {
  for (let i = 0; i < 240; i++) {
    const found = get();
    if (found) return found;
    await frame();
  }
  throw new Error(`timed out waiting for ${what}`);
};

const HERE = { lat: -22.9068, lng: -43.1729 };

/** @typedef {HTMLElement & { engine: import("../types.ts").MapEngine | null }} MapElement */

/** @type {MapElement[]} */
const mounted = [];

/** @param {Record<string, unknown>} props */
const mount = (props) => {
  if (!customElements.get("maps-view")) View.define("maps-view", mapsViewDef);
  const el = document.createElement("maps-view");
  el.style.cssText = "display:block;width:400px;height:300px";
  Object.assign(el, { tileUrl: "data:,", manifestUrl: "data:application/json,null", fit: false, center: [HERE.lat, HERE.lng], zoom: 15, ...props });
  document.body.appendChild(el);
  mounted.push(/** @type {MapElement} */ (el));
  return /** @type {MapElement} */ (el);
};

const unmountAll = () => {
  for (const el of mounted.splice(0)) el.remove();
};

describe("maps-view pins", () => {
  before(() => loadSheet());

  after(unmountAll);

  it("draws a point as a drop in its colour, the icon on its head and its tip on the point", async () => {
    const map = mount({ points: [{ ...HERE, id: "a", name: "A", color: "rgb(255, 0, 0)", icon: "music" }] });
    const pin = await until(() => /** @type {HTMLElement | null} */ (map.querySelector(".maps-view-pin-drop")), "the pin");
    await frame();
    assert.equal(pin.style.getPropertyValue("--maps-pin-color"), "rgb(255, 0, 0)");
    assert.equal(getComputedStyle(/** @type {Element} */ (pin.querySelector(".maps-view-pin-body"))).fill, "rgb(255, 0, 0)");
    assert.equal(pin.querySelector(".maps-view-pin-icon")?.getAttribute("name"), "music");
    const canvas = /** @type {HTMLElement} */ (map.querySelector(".maps-view-canvas")).getBoundingClientRect();
    const box = pin.getBoundingClientRect();
    assert.ok(Math.abs(box.left + 18 - (canvas.left + canvas.width / 2)) <= 1, `tip x ${box.left + 18}, point x ${canvas.left + canvas.width / 2}`);
    assert.ok(Math.abs(box.top + 41 - (canvas.top + canvas.height / 2)) <= 1, `tip y ${box.top + 41}, point y ${canvas.top + canvas.height / 2}`);
  });

  it("rings a cluster with its points' colours, in proportion", async () => {
    const near = (/** @type {number} */ i, /** @type {string} */ color) => ({ lat: HERE.lat + i * 0.0001, lng: HERE.lng, id: `p${i}`, name: `P${i}`, color });
    const map = mount({ zoom: 10, points: [near(0, "red"), near(1, "red"), near(2, "red"), near(3, "blue")] });
    const cluster = await until(() => /** @type {HTMLElement | null} */ (map.querySelector(".maps-view-cluster")), "the cluster");
    assert.equal(cluster.style.getPropertyValue("--maps-cluster-ring-background").replace(/\s+/g, " "), "conic-gradient(red 0.00% 75.00%,blue 75.00% 100.00%)");
    assert.equal(cluster.querySelector(".maps-view-cluster-count")?.textContent, "4");
  });

  it("grows the selected pin from its tip", async () => {
    const map = mount({ points: [{ ...HERE, id: "a", name: "A" }], activeId: "a" });
    const pin = await until(() => /** @type {HTMLElement | null} */ (map.querySelector(".maps-view-pin-drop.is-active")), "the selected pin");
    assert.equal(getComputedStyle(pin).scale, "1.18");
    assert.equal(getComputedStyle(pin).transformOrigin, "18px 41px");
  });

  it("draws a point whose thumbnail fails to load as a drop", async () => {
    const map = mount({ points: [{ ...HERE, id: "a", name: "A", thumb: "data:image/png;base64,broken" }] });
    await until(() => map.querySelector(".maps-view-pin-drop"), "the drop that replaces the broken photo");
    assert.equal(map.querySelector(".maps-view-pin-photo"), null);
  });

  it("draws a photo pin at the size the theme asks, with the hour under it, the count at its shoulder and faces below", async () => {
    const map = mount({ points: [{ ...HERE, id: "a", name: "A", thumb: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", badgeText: "19:00", count: 6, faces: [{ name: "Martina" }, { src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", name: "Tom" }, { name: "Ana" }, { name: "Four" }] }] });
    map.style.setProperty("--maps-pin-photo-size", "54px");
    const pin = await until(() => /** @type {HTMLElement | null} */ (map.querySelector(".maps-view-pin-photo")), "the photo pin");
    await frame();
    assert.equal(getComputedStyle(pin).width, "54px");
    assert.equal(getComputedStyle(pin).marginLeft, "-27px", "and still centred on the point");
    assert.equal(pin.querySelector(".maps-view-pin-text")?.textContent, "19:00");
    assert.equal(pin.querySelector(".maps-view-pin-count")?.textContent, "6");
    assert.equal(pin.querySelectorAll(".maps-view-pin-face").length, 3, "three faces at most");
    assert.equal(pin.querySelector("img.maps-view-pin-face")?.getAttribute("alt"), "Tom");
    assert.equal(pin.querySelector("span.maps-view-pin-face")?.textContent, "M", "a face with no photo is an initial");
    assert.equal(pin.querySelector(".maps-view-pin-glyph"), null, "a count takes the shoulder, so no glyph there");
    assert.equal(pin.querySelector(".maps-view-pin-play"), null, "nothing plays unless the point says so");
  });

  it("draws the play glyph only on a point that plays", async () => {
    const map = mount({ points: [{ ...HERE, id: "a", name: "A", thumb: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", play: true }] });
    const pin = await until(() => /** @type {HTMLElement | null} */ (map.querySelector(".maps-view-pin-photo")), "the photo pin");
    assert.ok(pin.querySelector(".maps-view-pin-play"));
  });

  it("leaves the zoom buttons out when asked", async () => {
    const map = mount({ points: [{ ...HERE, id: "a", name: "A" }], zoomButtons: false });
    await until(() => map.querySelector(".maps-view-pin"), "a pin");
    assert.equal(map.querySelectorAll(".maps-view-zoom").length, 0);
    const other = mount({ points: [{ ...HERE, id: "b", name: "B" }] });
    await until(() => other.querySelector(".maps-view-pin"), "a pin");
    assert.equal(other.querySelectorAll(".maps-view-zoom").length, 2);
  });

  it("draws a route's stops in order, joined by a line", async () => {
    const map = mount({ route: [{ ...HERE, label: "A" }, { lat: HERE.lat + 0.001, lng: HERE.lng }] });
    const marks = await until(() => { const all = map.querySelectorAll(".maps-view-route-mark"); return all.length === 2 ? all : null; }, "the route marks");
    assert.deepEqual([...marks].map((m) => m.textContent), ["A", "2"]);
    await frame();
    assert.equal(map.querySelector(".maps-view-route-line polyline")?.getAttribute("points")?.split(" ").length, 2);
  });

  it("tells the page which point a pin click chose", async () => {
    const map = mount({ points: [{ ...HERE, id: "a", name: "A" }] });
    const pin = await until(() => /** @type {HTMLElement | null} */ (map.querySelector(".maps-view-pin-drop")), "the pin");
    /** @type {Promise<CustomEvent>} */
    const clicked = new Promise((resolve) => map.addEventListener("pin-click", (e) => resolve(/** @type {CustomEvent} */ (e)), { once: true }));
    pin.click();
    assert.equal((await clicked).detail.point.id, "a");
  });

  it("opens nothing over a clicked pin when popups are off, and still says which pin", async () => {
    const map = mount({ points: [{ ...HERE, id: "a", name: "A" }], popups: false });
    /** @type {string[]} */
    const clicked = [];
    map.addEventListener("pin-click", (/** @type {Event} */ e) => clicked.push(String(/** @type {CustomEvent<{ point: { id: string } }>} */ (e).detail.point.id)));
    const pin = await until(() => /** @type {HTMLElement | null} */ (map.querySelector(".maps-view-pin")), "the pin");
    pin.click();
    assert.deepEqual(clicked, ["a"]);
    assert.equal(/** @type {HTMLElement} */ (map.querySelector(".maps-view-popup")).hidden, true, "the popup stays hidden");
  });

  it("opens the app's popup template over a clicked pin, and its close control hides it", async () => {
    const map = mount({ points: [{ ...HERE, id: "a", name: "A" }], popup: (/** @type {{ name: string }} */ pt) => html`<p class="popup-body">${pt.name} here</p>` });
    const pin = await until(() => /** @type {HTMLElement | null} */ (map.querySelector(".maps-view-pin-drop")), "the pin");
    pin.click();
    const popup = /** @type {HTMLElement} */ (map.querySelector(".maps-view-popup"));
    assert.equal(popup.hidden, false);
    assert.equal(popup.querySelector(".popup-body")?.textContent, "A here");
    /** @type {HTMLElement} */ (popup.querySelector(".maps-view-popup-close")).click();
    assert.equal(popup.hidden, true);
    assert.equal(popup.querySelector(".popup-body"), null);
  });

  it("stops answering taps once a map without keepalive is removed", async () => {
    const map = mount({ points: [{ ...HERE, id: "a", name: "A" }] });
    const canvas = await until(() => map.querySelector(".maps-view-canvas .maps-view-markers")?.parentElement, "the canvas");
    let taps = 0;
    map.addEventListener("map-tap", () => taps++);
    canvas.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.equal(taps, 1);
    const live = maps.count();
    map.remove();
    assert.equal(maps.count(), live - 1);
    canvas.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.equal(taps, 1);
    assert.equal(canvas.querySelector(".maps-view-markers"), null);
  });

  it("draws again when a removed map is attached anew", async () => {
    const map = mount({ points: [{ ...HERE, id: "a", name: "A" }] });
    await until(() => map.querySelector(".maps-view-pin"), "the first pin");
    map.remove();
    document.body.appendChild(map);
    const pin = await until(() => map.querySelector(".maps-view-pin"), "the pin after re-attaching");
    assert.ok(pin.isConnected);
  });
});

describe("maps-view keepalive", () => {
  before(unmountAll);

  after(() => {
    unmountAll();
    maps.dispose();
  });

  it("parks its engine on removal, and the next map on the same tiles takes it over", async () => {
    const first = mount({ keepalive: true, tileUrl: "data:,parked" });
    const engine = await until(() => first.engine, "the first engine");
    assert.equal(maps.count(), 1);
    first.remove();
    assert.equal(maps.count(), 1);
    const next = mount({ keepalive: true, tileUrl: "data:,parked" });
    assert.equal(await until(() => next.engine, "the adopted engine"), engine);
    assert.equal(maps.count(), 1);
    assert.ok(next.querySelector(".maps-view-canvas .maps-view-markers"), "the newcomer mounted its panes on the adopted canvas");
  });

  it("hands a live engine to a newcomer on the same tiles", async () => {
    const live = maps.count();
    const donor = mount({ keepalive: true, tileUrl: "data:,donor" });
    const engine = await until(() => donor.engine, "the donor's engine");
    const next = mount({ keepalive: true, tileUrl: "data:,donor" });
    assert.equal(await until(() => next.engine, "the handed-over engine"), engine);
    assert.equal(donor.engine, null);
    assert.equal(donor.querySelector(".maps-view-canvas"), null);
    assert.equal(maps.count(), live + 1);
  });

  it("destroys a parked engine nobody takes within the grace period", async () => {
    const map = mount({ keepalive: true, tileUrl: "data:,grace" });
    await until(() => map.engine, "the engine");
    const live = maps.count();
    map.remove();
    assert.equal(maps.count(), live);
    await until(() => maps.count() === live - 1 || null, "the parked engine to be destroyed");
  });
});
