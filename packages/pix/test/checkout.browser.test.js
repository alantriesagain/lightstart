/// <reference lib="dom" />
/**
 * @file `<pix-checkout>` in Chromium: it starts from the account's name, asks
 * the server for a charge, draws the BR Code it answered as a QR and as a code
 * to copy, hands the pending charge to its host, starts at a charge already
 * waiting, says so when the server refuses, and asks nothing of a signed-out
 * reader.
 */

import assert from "node:assert/strict";
import { afterEach, before, beforeEach, describe, it } from "node:test";
import { auth, configureAuth } from "@lightstart/auth/page";
import View from "@lightstart/light";
import { nameControllers } from "@lightstart/light/controller";
import { syncPlugin } from "@lightstart/light/controller/view";
import inputDef from "@lightstart/components/form/input.js";
import buttonDef from "@lightstart/components/display/button.js";
import clipboardDef from "@lightstart/components/utility/clipboard.js";
import qrDef from "@lightstart/qr/views/code.js";

import { brcode } from "../lib/brcode.ts";
import checkoutDef from "../views/checkout.ts";

const PIX = { key: "pix@meetup.rio", name: "MEETUP RIO", city: "RIO DE JANEIRO" };
const CHARGE = {
  id: "c1",
  userId: "u_ana",
  plan: "place",
  amount: 4900,
  currency: "BRL",
  provider: "pix",
  providerRef: "ABCDEFGHJKLMNPQRSTUV",
  status: "pending",
  paidAt: "",
  context: {},
  data: { payer: "Bip Bip Bar Ltda" },
};
const CODE = brcode({ key: PIX.key, name: PIX.name, city: PIX.city, amount: CHARGE.amount, txid: CHARGE.providerRef });

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];
/** @type {Array<Record<string, unknown>>} */
let asked = [];
let refuse = false;

/** @param {unknown} body @param {number} [status] */
const respond = (body, status = 200) => /** @type {Response} */ (/** @type {unknown} */ ({ ok: status >= 200 && status < 300, status, json: async () => body }));

/** @param {RequestInfo | URL} input @param {RequestInit} [init] */
const fakeFetch = async (input, init) => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(href, "http://app.test").pathname;
  if (init?.method === "POST" && path === "/api/pix/charge") {
    const body = JSON.parse(String(init.body));
    asked.push(body);
    if (refuse) return respond({ error: "rate limited" }, 400);
    return respond({ charge: { ...CHARGE, context: body.context, data: { payer: body.payer } }, code: CODE });
  }
  if (path === "/api/auth/me") return respond({});
  return respond({});
};

const storage = { getItem: () => "token-1", setItem: () => {}, removeItem: () => {} };

/** @typedef {HTMLElement & { $requestUpdate(): Promise<unknown>, payer: string, charge: unknown, code: string, state: string }} CheckoutElement */

/** @param {Record<string, unknown>} props @returns {Promise<CheckoutElement>} */
const mount = async (props) => {
  const el = /** @type {CheckoutElement} */ (document.createElement("pix-checkout"));
  Object.assign(el, props);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

/** @param {CheckoutElement} el */
const settle = async (el) => {
  for (let index = 0; index < 20 && el.state === "making"; index++) await tick();
  await el.$requestUpdate();
};

describe("@lightstart/pix - checkout", () => {
  before(async () => {
    configureAuth({ fetch: fakeFetch, storage });
    nameControllers([auth]);
    View.use(syncPlugin);
    if (!customElements.get("pix-checkout")) View.define("pix-checkout", checkoutDef);
    if (!customElements.get("lc-input")) View.define("lc-input", inputDef);
    if (!customElements.get("lc-button")) View.define("lc-button", buttonDef);
    if (!customElements.get("lc-clipboard")) View.define("lc-clipboard", clipboardDef);
    if (!customElements.get("qr-code")) View.define("qr-code", qrDef);
    await auth.$ready;
  });

  beforeEach(() => {
    asked = [];
    refuse = false;
    auth.user = { id: "u_ana", name: "Bip Bip Bar", email: "ana@example.com", admin: false };
  });

  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove();
  });

  it("asks who is paying, then draws the code for the charge the server made", async () => {
    /** @type {Array<[string, unknown]>} */
    const done = [];
    const el = await mount({ plan: "place", context: { kind: "claim", slug: "bar-bip-bip" }, done: (/** @type {string} */ status, /** @type {Record<string, unknown> | null} */ charge) => done.push([status, charge?.["id"]]) });
    assert.ok(el.querySelector("[data-pix-ask]"));
    assert.equal(el.payer, "Bip Bip Bar", "the account's name to start");
    el.payer = "Bip Bip Bar Ltda";
    /** @type {HTMLElement} */ (el.querySelector("[data-pix-show]")).click();
    await settle(el);

    assert.deepEqual(asked, [{ plan: "place", context: { kind: "claim", slug: "bar-bip-bip" }, payer: "Bip Bip Bar Ltda" }]);
    assert.equal(el.querySelector("[data-pix-code]")?.getAttribute("data-pix-code"), CODE);
    assert.equal(el.querySelector("lc-clipboard")?.getAttribute("text"), CODE, "the code copied is the code the QR holds");
    assert.equal(el.querySelector("qr-code")?.getAttribute("value"), CODE);
    assert.match(String(el.querySelector("[data-pix-amount]")?.textContent), /49/);
    assert.match(String(el.querySelector("[data-pix-ref]")?.textContent), /ABCDEFGHJKLMNPQRSTUV/);

    /** @type {HTMLElement} */ (el.querySelector("[data-pix-paid]")).click();
    assert.deepEqual(done, [["pending", "c1"]]);
  });

  it("shows a charge still waiting again, asking for no new one", async () => {
    const el = await mount({ plan: "place", charge: CHARGE, code: CODE });
    assert.equal(el.querySelector("[data-pix-ask]"), null);
    assert.match(String(el.querySelector("[data-pix-ref]")?.textContent), /ABCDEFGHJKLMNPQRSTUV/);
    assert.equal(asked.length, 0);
  });

  it("says so when the charge is refused, and asks again", async () => {
    refuse = true;
    const el = await mount({ plan: "place" });
    /** @type {HTMLElement} */ (el.querySelector("[data-pix-show]")).click();
    await settle(el);
    assert.ok(el.querySelector("[role=alert]"));
    assert.equal(el.querySelector("[data-pix-code]"), null);
  });

  it("asks nothing of somebody signed out", async () => {
    auth.user = null;
    const el = await mount({ plan: "place" });
    await el.$requestUpdate();
    assert.ok(el.querySelector("[data-pix-signin]"));
    assert.equal(asked.length, 0);
  });
});
