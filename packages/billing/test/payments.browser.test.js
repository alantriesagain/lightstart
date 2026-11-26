/**
 * @file The payments page in Chromium: the admin's pending charge drawn, its
 * statement while it waits, Mark paid moving it, a granted period in the
 * detail, and a non-admin seeing the not-allowed state instead of the list.
 */

/// <reference lib="dom" />
import { afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { auth, configureAuth } from "@lightstart/auth/page";
import View from "@lightstart/light";
import { nameControllers } from "@lightstart/light/controller";
import { syncPlugin } from "@lightstart/light/controller/view";

import payments from "../payments/controller.ts";
import pageDef from "../views/payments.ts";
import detailDef from "../views/payments-detail.ts";

/** @typedef {HTMLElement & { $requestUpdate(): Promise<unknown>, tab: string, selected: string }} LightElement */

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

const period = { id: "charge:c2", userId: "u2", key: "place", source: "charge", ref: "c2", plan: "place", startsAt: "2026-09-01 00:00:00", expiresAt: "2026-10-01 00:00:00", status: "active" };
const rows = [
  { id: "c1", userId: "u1", plan: "place", amount: 4900, currency: "BRL", provider: "pix", providerRef: "K7F3M2QX9TRPAB4HN6WD", status: "pending", paidAt: "", context: { kind: "claim", slug: "casa-porto" }, data: { payer: "Bip Bip Bar Ltda" }, created: "2026-09-02 10:00:00" },
  { id: "c2", userId: "u2", plan: "place", amount: 4900, currency: "BRL", provider: "pix", providerRef: "A1B2C3D4E5F6G7H8J9K0", status: "paid", paidAt: "2026-09-01 10:00:00", context: { kind: "renew" }, data: {}, created: "2026-08-31 10:00:00" },
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
  if (method === "GET" && path === "/api/billing/charges") return respond({ rows, entitlements: [period] });
  if (method === "PATCH") {
    const id = path.split("/").pop();
    const found = rows.find((row) => row.id === id);
    if (found) found.status = "paid";
    return respond(found ?? {});
  }
  return respond({});
};

const storage = {
  getItem: () => "token-1",
  setItem: () => {},
  removeItem: () => {},
};

const admin = { id: "u-admin", email: "admin@example.com", name: "Ada Admin", admin: true };
const member = { id: "u-member", email: "member@example.com", name: "Mia Member", admin: false };

describe("@lightstart/billing - payments page", () => {
  before(async () => {
    configureAuth({ fetch: fakeFetch, storage });
    nameControllers([payments, auth]);
    View.use(syncPlugin);
    if (!customElements.get("payments-page")) View.define("payments-page", pageDef);
    if (!customElements.get("payments-detail")) View.define("payments-detail", detailDef);
    await auth.$ready;
  });

  afterEach(() => {
    for (const element of mounted.splice(0)) element.remove();
  });

  it("draws the pending charge, its statement, and moves it on Mark paid", async () => {
    rows[0].status = "pending";
    auth.user = admin;
    await payments.load();
    const page = await mount("payments-page");
    assert.ok(page.querySelector('[data-payments-item="c1"]'), "the pending charge is listed");
    assert.ok(page.querySelector('[data-payments-detail="c1"]'), "its detail is beside it");
    assert.ok(page.querySelector("[data-payments-statement]"), "a waiting charge says what to look for");

    const markPaid = /** @type {HTMLElement} */ (page.querySelector('[data-payments-move="paid"]'));
    markPaid.click();
    for (let index = 0; index < 20 && payments.charge("c1")?.status !== "paid"; index++) await tick();
    assert.equal(payments.charge("c1")?.status, "paid", "Mark paid moves the charge through the endpoint");

    page.tab = "paid";
    await page.$requestUpdate();
    assert.ok(page.querySelector('[data-payments-item="c1"]'), "the paid tab holds it now");
  });

  it("draws the period a paid charge granted", async () => {
    auth.user = admin;
    await payments.load();
    const page = await mount("payments-page");
    page.tab = "paid";
    await page.$requestUpdate();
    const paid = /** @type {HTMLElement} */ (page.querySelector('[data-payments-item="c2"]'));
    paid.dispatchEvent(new CustomEvent("select"));
    await page.$requestUpdate();
    assert.ok(page.querySelector("[data-payments-period]"), "the detail says the period it granted");
  });

  it("a non-admin sees the not-allowed state, not the list", async () => {
    auth.user = member;
    const page = await mount("payments-page");
    assert.ok(page.querySelector('[data-payments-gate="not-allowed"]'));
    assert.equal(page.querySelector("[data-payments-list]"), null);
  });

  it("a signed-out account is asked to sign in", async () => {
    auth.user = null;
    const page = await mount("payments-page");
    assert.ok(page.querySelector('[data-payments-gate="sign-in"]'));
  });
});
