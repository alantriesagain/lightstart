/**
 * @file `<play-checkout>`: subscribing to a plan through Google Play in the
 * Android shell. It shows the price and the free days as Play states them for
 * this device, then Subscribe opens Play's own sheet under the account id the
 * server gave this person. What Play answers is handed to the server, which
 * reads it back from Play before it grants anything.
 */

import { appUrl } from "@lightstart/app/base.ts";
import { auth, authFetch, authPrefix, readToken } from "@lightstart/auth/page";
import { defineComponent, translate } from "@lightstart/light";
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { mobile } from "@lightstart/mobile/page";

import { PLAY_BUY, PLAY_PRODUCTS } from "../commands.ts";
import words from "../locales/en.js";

import type { AuthUser } from "@lightstart/auth/server/types.ts";
import type { PlayProduct } from "../types.ts";

const TAG = "play-checkout";

type Row = Record<string, unknown>;

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

const word = (key: string, vars: Record<string, string | number> = {}): string => {
  const path = `${TAG}.${key}`;
  const found = translate(path, vars);
  if (found !== undefined && found !== path) return found;
  const english = (words as Record<string, Record<string, string>>)[TAG]?.[key] ?? key;
  return english.replace(/\{(\w+)\}/g, (_match, name: string) => String(vars[name] ?? ""));
};

interface Answer {
  ok: boolean;
  body: unknown;
  error: string;
}

const urlOf = (path: string): string => `${appUrl("")}${authPrefix()}${path}`;

const send = async (method: string, path: string, body?: Row): Promise<Answer> => {
  const token = readToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token !== null && token !== "") headers["authorization"] = `Bearer ${token}`;
  try {
    const response = await authFetch()(urlOf(path), { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let value: unknown = null;
    try {
      value = await response.json();
    } catch {
      value = null;
    }
    if (!response.ok) return { ok: false, body: value, error: (isRecord(value) ? String(value["error"] ?? "") : "") || `The request failed (${String(response.status)})` };
    return { ok: true, body: value, error: "" };
  } catch (error) {
    return { ok: false, body: null, error: error instanceof Error ? error.message : String(error) };
  }
};

export default defineComponent({
  tag: TAG,
  class: "block",
  props: {
    plan: "",
    user: T.any({ defaultValue: null, attribute: false, sync: auth }),
    done: T.function({ defaultValue: null, attribute: false }),
    product: T.any({ defaultValue: null, attribute: false }),
    state: T.string({ defaultValue: "", attribute: false, enum: ["", "buying", "failed"] }),
  },

  async connected() {
    const user = this.user as unknown as AuthUser | null;
    if (user === null || !this.plan || !mobile.can("play")) return;
    try {
      const products = await mobile.request<PlayProduct[]>(PLAY_PRODUCTS, [{ ids: [this.plan] }]);
      this.product = (products ?? []).find((entry) => entry.id === this.plan) ?? null;
    } catch {
      this.product = null;
    }
  },

  async _buy() {
    if (this.state === "buying") return;
    this.state = "buying";
    try {
      const account = await send("GET", "/api/play-account");
      if (!account.ok) throw new Error(account.error || "no account id");
      const accountId = String((isRecord(account.body) ? account.body["accountId"] : "") ?? "");
      if (accountId === "") throw new Error("no account id");
      const bought = await mobile.request<{ purchaseToken?: string } | null>(PLAY_BUY, [{ productId: this.plan, accountId }]);
      if (!bought?.purchaseToken) throw new Error("no purchase");
      const granted = await send("POST", "/api/play-purchase", { purchaseToken: bought.purchaseToken });
      if (!granted.ok) throw new Error(granted.error || "not granted");
      this.state = "";
      const pending = isRecord(granted.body) && granted.body["pending"] === true;
      const done = this.done as unknown as ((status: "pending" | "paid", charge: null) => void) | null;
      done?.(pending ? "pending" : "paid", null);
    } catch (error) {
      console.warn("[play] the subscription did not go through:", error instanceof Error ? error.message : error);
      this.state = "failed";
    }
  },

  render() {
    const user = this.user as unknown as AuthUser | null;
    if (user === null) return html`<p class="text-[13px] font-semibold text-muted" data-play-signin>${word("signIn")}</p>`;
    const product = this.product as unknown as PlayProduct | null;
    if (product === null) return "";
    const buying = this.state === "buying";
    return html`
      <div class="flex flex-col gap-3" data-play-checkout=${product.id}>
        <div class="rounded-3xl border border-black/10 bg-surface p-4 shadow-md dark:border-white/10">
          <span class="text-[11px] font-bold uppercase tracking-widest text-muted">${word("title")}</span>
          <div class="mt-1.5 text-[24px] font-black leading-tight text-default" data-play-price>${word("perMonth", { price: product.price })}</div>
          ${product.trialDays ? html`<div class="mt-1 text-[13px] font-bold text-default" data-play-trial>${word("trial", { days: product.trialDays })}</div>` : ""}
          <p class="mt-2 text-[12px] font-semibold leading-snug text-muted">${word("renews")}</p>
        </div>
        <lc-button primary wFull data-play-subscribe ?disabled=${buying} @click=${() => this._buy()}>${word(buying ? "working" : "subscribe")}</lc-button>
        ${this.state === "failed" ? html`<p role="alert" class="text-[13px] font-semibold text-danger">${word("failed")}</p>` : ""}
      </div>`;
  },
});
