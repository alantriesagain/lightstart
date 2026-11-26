/**
 * @file `<pix-checkout>`: paying for a plan with Pix. It asks the name on the
 * account the Pix comes from, which is how the payment is found on the
 * statement, then asks the server for a charge and shows its BR Code as a QR
 * and as a code to copy, with the amount and the reference. "I've paid" tells
 * whoever drew it; the payment is confirmed later in billing's
 * `/admin/payments`.
 *
 * The checkout draws the code the server answered, since the Pix key and the
 * merchant name and city are the server's environment (`PIX_KEY`,
 * `PIX_MERCHANT_NAME`, `PIX_MERCHANT_CITY`), not the page's.
 */

import { defineComponent } from "@lightstart/light";
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { translation } from "@lightstart/light/i18n";
import { appUrl } from "@lightstart/app/base.ts";
import { auth, authFetch, authPrefix, readToken } from "@lightstart/auth/page";

import words from "../locales/en.js";

import type { AuthUser } from "@lightstart/auth/server/types.ts";
import type { ChargeRow } from "@lightstart/billing";
import type { PixCharge } from "../types.ts";

const TAG = "pix-checkout";

const fill = (text: string, vars: Record<string, unknown>): string =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));

const say = (key: string, vars: Record<string, unknown> = {}): string => {
  const path = `${TAG}.${key}`;
  const found = translation.translate(path, vars);
  if (found) return found;
  const english = (words[TAG] as Record<string, string>)[key];
  return english === undefined ? key : fill(english, vars);
};

const money = (amount: number, currency: string): string => {
  const code = currency === "" ? "BRL" : currency;
  const language = translation.language();
  const locale = language.toLowerCase().startsWith("pt") ? "pt-BR" : language;
  return new Intl.NumberFormat(locale, { style: "currency", currency: code, maximumFractionDigits: 2 })
    .format(amount / 100)
    .replace(/\u00a0/g, " ");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const urlOf = (path: string): string => `${appUrl("")}${authPrefix()}${path}`;

/**
 * The Pix checkout for one plan. It follows the `auth` session: signed out, it
 * asks for a sign-in and nothing else. Handed a `charge` and its `code`, it
 * starts at the code instead of asking for a new charge.
 *
 * @example
 * ```html
 * <pix-checkout plan="place" .context=${{ kind: "claim" }} .done=${onDone}></pix-checkout>
 * ```
 */
export default defineComponent({
  tag: TAG,
  class: "block",
  props: {
    user: T.object({ defaultValue: null, sync: auth }),
    plan: "",
    context: T.object({ defaultValue: {}, attribute: false }),
    done: T.function({ defaultValue: null, attribute: false }),
    payer: T.string({ defaultValue: "", attribute: false }),
    charge: T.object({ defaultValue: null, attribute: false }),
    code: "",
    state: T.string({ defaultValue: "", attribute: false, enum: ["", "making", "failed"] }),
  },
  connected() {
    const user = this._user();
    if (!this.payer && user !== null) this.payer = String(user.name || "");
  },

  _user(): AuthUser | null {
    return this.user as unknown as AuthUser | null;
  },

  _charge(): ChargeRow | null {
    return this.charge as unknown as ChargeRow | null;
  },

  async _make(): Promise<void> {
    if (this.state === "making") return;
    this.state = "making";
    const token = readToken();
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token !== null && token !== "") headers["authorization"] = `Bearer ${token}`;
    try {
      const response = await authFetch()(urlOf("/api/pix/charge"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          plan: this.plan,
          context: this.context as Record<string, string>,
          payer: this.payer.trim(),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(body) || !isRecord(body["charge"]) || typeof body["code"] !== "string") {
        this.state = "failed";
        return;
      }
      const answer = body as unknown as PixCharge;
      this.charge = answer.charge as unknown as Record<string, unknown>;
      this.code = answer.code;
      this.state = "";
    } catch {
      this.state = "failed";
    }
  },

  _ask() {
    const making = this.state === "making";
    return html`
      <div class="flex flex-col gap-3" data-pix-ask>
        <lc-input class="block" label=${say("payingFrom")} placeholder=${say("payingFromHint")} .value=${this.payer}
          @input=${(e: CustomEvent<{ value: string }>) => { this.payer = e.detail.value; }}></lc-input>
        <lc-button primary wFull data-pix-show ?disabled=${making || !this.payer.trim()} @click=${() => void this._make()}>${say("show")}</lc-button>
        ${this.state === "failed" ? html`<p role="alert" class="text-[13px] font-semibold text-danger">${say("failed")}</p>` : ""}
      </div>`;
  },

  _show() {
    const charge = this._charge() as ChargeRow;
    return html`
      <div class="flex flex-col gap-4" data-pix-code=${this.code}>
        <div class="flex items-center gap-3.5 rounded-3xl border border-black/10 bg-surface p-3.5 shadow-md dark:border-white/10">
          <div class="shrink-0 rounded-2xl border border-black/10 p-2 leading-none dark:border-white/10"><qr-code value=${this.code} size="132" label=${say("title")}></qr-code></div>
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="text-[11px] font-bold uppercase tracking-widest text-muted">${say("title")}</span>
            <span class="mt-1.5 text-[27px] font-black leading-none text-default" data-pix-amount>${money(charge.amount, charge.currency)}</span>
            <lc-clipboard class="mt-3 block" text=${this.code} label=${say("copy")} copiedLabel=${say("copied")}></lc-clipboard>
          </div>
        </div>
        <ol class="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px] font-semibold leading-snug text-default">
          <li class="flex items-start gap-2.5"><span class="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-bar text-[11.5px] font-black text-highlight">1</span>${say("scan")}</li>
          <li class="flex items-start gap-2.5"><span class="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-bar text-[11.5px] font-black text-highlight">2</span>${say("check")}</li>
        </ol>
        <p class="m-0 text-[12px] font-semibold text-muted" data-pix-ref>${say("reference", { ref: charge.providerRef })}</p>
        <lc-button primary wFull data-pix-paid @click=${() => this._done("pending", charge)}>${say("paid")}</lc-button>
      </div>`;
  },

  _done(status: "pending" | "paid", charge: ChargeRow | null): void {
    const done = this.done as unknown as ((status: "pending" | "paid", charge: ChargeRow | null) => void) | null;
    done?.(status, charge);
  },

  render() {
    if (this._user() === null) return html`<p class="text-[13px] font-semibold text-muted" data-pix-signin>${say("signIn")}</p>`;
    return this._charge() !== null ? this._show() : this._ask();
  },
});
