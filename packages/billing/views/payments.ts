/**
 * @file `<payments-page>`: the admin's payments at `/admin/payments`. It
 * draws the charges in their tabs, the selected charge's detail beside the
 * list, and a Refresh action. It shows a sign-in or not-allowed state unless
 * the signed-in account is an admin; the server refuses a non-admin's calls
 * either way.
 */

import { auth } from "@lightstart/auth/page";
import { defineComponent, translate } from "@lightstart/light";
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";

import { TABS, dateOf, forWhat, money, planLabel } from "../payments/lib.ts";
import payments from "../payments/controller.ts";

import type { AuthUser } from "@lightstart/auth/server/types.ts";
import type { ChargeRow } from "../types.ts";

const word = (key: string, fallback: string): string => translate(key) ?? fallback;

export default defineComponent({
  tag: "payments-page",
  props: {
    charges: T.array({ defaultValue: [], sync: payments }),
    entitlements: T.array({ defaultValue: [], sync: payments }),
    loading: T.boolean({ defaultValue: false, sync: payments }),
    message: T.string({ defaultValue: "", sync: payments }),
    user: T.object({ attribute: false, defaultValue: null, sync: auth }),
    tab: "to-match",
    selected: "",
  },

  connected() {
    return payments.load();
  },

  _user(): AuthUser | null {
    return this.user as unknown as AuthUser | null;
  },

  _charges(): ChargeRow[] {
    return this.charges as ChargeRow[];
  },

  _gate(): object | string {
    const user = this._user();
    if (user === null)
      return html`
        <div class="payments-gate" data-payments-gate="sign-in">
          <h2>${word("payments-page.signIn", "Sign in to see payments")}</h2>
          <p>${word("payments-page.signInBody", "Payments are only for an admin.")}</p>
        </div>
      `;
    return html`
      <div class="payments-gate" data-payments-gate="not-allowed">
        <h2>${word("payments-page.notAllowed", "Not allowed")}</h2>
        <p>${word("payments-page.notAllowedBody", "This account is not an admin.")}</p>
      </div>
    `;
  },

  _row(charge: ChargeRow, selected: string): object | string {
    const date = charge.status === "paid" ? charge.paidAt : (charge.created ?? "");
    return html`
      <lc-list-row
        size="sm"
        data-payments-item=${charge.id}
        icon="banknote"
        label=${money(charge.amount, charge.currency)}
        hint=${[planLabel(charge.plan), forWhat(charge), dateOf(date, { time: true }), payments.whoIs(charge.userId)].filter(Boolean).join(" · ")}
        meta=${charge.status}
        ?selected=${charge.id === selected}
        @select=${() => { this.selected = charge.id; }}
      ></lc-list-row>
    `;
  },

  render() {
    const user = this._user();
    if (user === null || user.admin !== true) return html`<div class="payments-page">${this._gate()}</div>`;
    const status = TABS.find((tab) => tab.id === this.tab)?.status ?? "pending";
    const rows = payments.inStatus(status);
    const selected = rows.some((row) => row.id === this.selected) ? this.selected : (rows[0]?.id ?? "");
    const picked = selected === "" ? null : payments.charge(selected);
    const options = TABS.map((tab) => ({ value: tab.id, label: word(tab.word, tab.label), count: payments.inStatus(tab.status).length }));
    return html`
      <div class="payments-page">
        <div class="payments-bar">
          <lc-segmented
            size="sm"
            data-payments-tabs
            .options=${options}
            value=${this.tab}
            @change=${(event: CustomEvent<{ value: string }>) => { this.tab = event.detail.value; }}
          ></lc-segmented>
          <span class="payments-spacer"></span>
          ${this.message ? html`<span class="payments-message" data-payments-message>${this.message}</span>` : ""}
          <lc-button size="sm" ghost icon="refresh-cw" ?disabled=${this.loading} @click=${() => void payments.load()}>
            ${word("payments-page.refresh", "Refresh")}
          </lc-button>
        </div>
        <div class="payments-columns">
          <section class="payments-list" data-payments-list>
            ${this.loading && !this._charges().length ? html`<lc-spinner></lc-spinner>` : ""}
            ${!this.loading && !rows.length ? html`<p class="payments-empty" data-payments-empty>${word("payments-page.empty", "Nothing here.")}</p>` : ""}
            ${rows.map((charge) => this._row(charge, selected))}
          </section>
          ${picked ? html`<section class="payments-detail-pane"><payments-detail .charge=${picked}></payments-detail></section>` : ""}
        </div>
      </div>
    `;
  },
});
