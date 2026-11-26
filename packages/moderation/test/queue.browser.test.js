/**
 * @file The review queue's page in Chromium: pending items drawn under their
 * kinds' headings, a kind's `detail` tag drawn for its detail, and a
 * non-admin seeing the not-allowed state instead of the list.
 */

/// <reference lib="dom" />
import { afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import View from "@lightstart/light";
import { nameControllers } from "@lightstart/light/controller";
import { syncPlugin } from "@lightstart/light/controller/view";
import { auth, configureAuth } from "@lightstart/auth/page";

import moderationQueue from "../queue/controller.ts";
import { queueKinds } from "../queue/slots.ts";
import pageDef from "../views/queue.ts";
import detailDef from "../views/queue-detail.ts";
import payloadDef from "../views/queue-payload.ts";
import photoDef from "../views/queue-photo.ts";
import sentDef from "../views/queue-sent.ts";

/** @typedef {HTMLElement & { $requestUpdate(): Promise<unknown> }} LightElement */

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/**
 * @param {string} tag
 * @returns {Promise<LightElement>}
 */
const mount = async (tag) => {
  const element = /** @type {LightElement} */ (document.createElement(tag));
  document.body.append(element);
  mounted.push(element);
  await tick();
  await element.$requestUpdate();
  return element;
};

const rows = [
  { id: "s1", kind: "avatar", status: "pending", created: "2026-09-01T10:00:00.000Z", userId: "u1", payload: { image: "data:image/png;base64,AAAA" } },
  { id: "s2", kind: "place", status: "pending", created: "2026-09-02T10:00:00.000Z", userId: "u2", payload: { name: "Praia de Ipanema" } },
];

/**
 * @param {unknown} body
 * @param {number} [status]
 * @returns {Response}
 */
const respond = (body, status = 200) => /** @type {Response} */ (/** @type {unknown} */ ({ ok: status >= 200 && status < 300, status, json: async () => body }));

/**
 * @param {RequestInfo | URL} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
const fakeFetch = async (input, init) => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(href, "http://app.test").pathname;
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "GET" && path === "/api/moderation/pending") return respond({ rows });
  return respond({});
};

const storage = {
  getItem: () => "token-1",
  setItem: () => {},
  removeItem: () => {},
};

const offs = [];

const admin = { id: "u-admin", email: "admin@example.com", name: "Ada Admin", admin: true };
const member = { id: "u-member", email: "member@example.com", name: "Mia Member", admin: false };

describe("@lightstart/moderation - review queue", () => {
  before(async () => {
    configureAuth({ fetch: fakeFetch, storage });
    nameControllers([moderationQueue, auth]);
    View.use(syncPlugin);
    offs.push(queueKinds.fill({ kind: "avatar", label: "Profile photo", group: "Photos", icon: "user-round", detail: "moderation-queue-photo" }));
    offs.push(queueKinds.fill({ kind: "place", label: "Place", group: "Places", icon: "map" }));
    if (!customElements.get("moderation-queue")) View.define("moderation-queue", pageDef);
    if (!customElements.get("moderation-queue-detail")) View.define("moderation-queue-detail", detailDef);
    if (!customElements.get("moderation-queue-payload")) View.define("moderation-queue-payload", payloadDef);
    if (!customElements.get("moderation-queue-photo")) View.define("moderation-queue-photo", photoDef);
    if (!customElements.get("moderation-queue-sent")) View.define("moderation-queue-sent", sentDef);
    await auth.$ready;
  });

  afterEach(() => {
    for (const element of mounted.splice(0)) element.remove();
  });

  it("draws pending items under their headings, and a kind's detail tag for its detail", async () => {
    auth.user = admin;
    await moderationQueue.load();
    const page = await mount("moderation-queue");

    const groups = [...page.querySelectorAll("[data-queue-group]")].map((group) => group.getAttribute("data-queue-group"));
    assert.deepEqual(groups, ["Photos", "Places"]);
    assert.ok(page.querySelector('[data-queue-item="s1"]'));
    assert.ok(page.querySelector('[data-queue-item="s2"]'));
    assert.ok(page.querySelector("moderation-queue-photo"), "the photo kind's detail tag draws its item");

    const place = /** @type {HTMLElement} */ (page.querySelector('[data-queue-item="s2"]'));
    place.dispatchEvent(new CustomEvent("select"));
    await page.$requestUpdate();
    assert.ok(page.querySelector('[data-queue-detail="s2"]'));
    assert.ok(page.querySelector("moderation-queue-payload"), "a kind with no detail tag reads its payload as fields");
    assert.equal(page.querySelector("moderation-queue-photo"), null);
  });

  it("a non-admin sees the not-allowed state, not the list", async () => {
    auth.user = member;
    const page = await mount("moderation-queue");
    assert.ok(page.querySelector('[data-queue-gate="not-allowed"]'));
    assert.equal(page.querySelector("[data-queue-list]"), null);
  });

  it("a signed-out account is asked to sign in", async () => {
    auth.user = null;
    const page = await mount("moderation-queue");
    assert.ok(page.querySelector('[data-queue-gate="sign-in"]'));
  });
});
