/**
 * @file `<payments-detail>`: one charge, what to look for on the statement
 * while it waits, the period it granted once paid, and the moves its status
 * allows (mark paid, cancel, refund).
 */

import { defineComponent, translate } from "@lightstart/light";
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";

import { dateOf, forWhat, money, periodOf, planLabel, statementOf } from "../payments/lib.ts";
import payments from "../payments/controller.ts";

import type { ChargeRow, EntitlementRow } from "../types.ts";

const word = (key: string, fallback: string): string => translate(key) ?? fallback;

const MOVES: Record<string, Array<{ to: "paid" | "canceled" | "refunded"; key: string; fallback: string; icon: string; primary?: boolean }>> = {
  pending: [
    { to: "paid", key: "payments-detail.markPaid", fallback: "Mark paid", icon: "check", primary: true },
    { to: "canceled", key: "payments-detail.cancel", fallback: "Cancel", icon: "x" },
  ],
  paid: [{ to: "refunded", key: "payments-detail.refund", fallback: "Refund", icon: "undo-2" }],
};

const TONE: Record<string, string> = { pending: "warning", paid: "success", canceled: "default", refunded: "info" };

export default defineComponent({
  tag: "payments-detail",
  props: {
    charge: T.object({ attribute: false, defaultValue: null }),
    entitlements: T.array({ defaultValue: [], sync: payments }),
    busy: T.string({ defaultValue: "", sync: payments }),
  },

  _charge(): ChargeRow | null {
    return this.charge as unknown as ChargeRow | null;
  },

  _period(charge: ChargeRow): string {
    const row = periodOf(charge, this.entitlements as EntitlementRow[]);
    if (row === null) return "";
    return `${dateOf(row.startsAt)} to ${dateOf(row.expiresAt)}, ${row.status === "active" ? word("payments-detail.active", "active") : word("payments-detail.ended", "ended")}`;
  },

  render() {
    const charge = this._charge();
    if (charge === null) return "";
    const statement = statementOf(charge);
    const period = this._period(charge);
    return html`
      <article class="payments-card" data-payments-detail=${charge.id}>
        <header class="payments-head">
          <div>
            <span class="payments-dim">${[charge.provider, charge.status === "pending" ? word("payments-detail.waiting", "waiting") : charge.status].filter(Boolean).join(", ")}</span>
            <div class="payments-amount">${money(charge.amount, charge.currency)}</div>
          </div>
          <lc-tag size="sm" variant=${TONE[charge.status] ?? "default"}>${charge.status === "paid" ? `${word("payments-detail.paid", "Paid")} ${dateOf(charge.paidAt)}` : charge.status}</lc-tag>
        </header>
        <dl class="payments-fields">
          <dt>${word("payments-detail.reference", "Reference")}</dt><dd class="payments-mono">${charge.providerRef}</dd>
          ${charge.data["payer"] ? html`<dt>${word("payments-detail.payer", "Paying from")}</dt><dd>${charge.data["payer"]}</dd>` : ""}
          <dt>${word("payments-detail.account", "Account")}</dt><dd>${payments.whoIs(charge.userId)}</dd>
          <dt>${word("payments-detail.plan", "Plan")}</dt><dd>${planLabel(charge.plan)}</dd>
          <dt>${word("payments-detail.for", "For")}</dt><dd>${forWhat(charge)}</dd>
          <dt>${word("payments-detail.asked", "Asked")}</dt><dd>${dateOf(charge.created, { time: true })}</dd>
          ${period ? html`<dt>${word("payments-detail.period", "Period")}</dt><dd data-payments-period>${period}</dd>` : ""}
        </dl>
        ${statement
          ? html`
              <section class="payments-statement" data-payments-statement>
                <span class="payments-label">${word("payments-detail.onStatement", "On the statement")}</span>
                <p>${word("payments-detail.statement", "A payment of")} <b>${statement.amount}</b>${statement.payer
                  ? html` ${word("payments-detail.statementFrom", "from")} <b>${statement.payer}</b>`
                  : ""}, ${word("payments-detail.statementRef", "with this in the description:")} <b>${statement.reference}…</b></p>
              </section>
            `
          : ""}
        ${charge.status === "paid" ? html`<p class="payments-dim payments-note">${word("payments-detail.refundNote", "Refunding ends the period it granted. The money goes back from the bank; this records it.")}</p>` : ""}
        ${MOVES[charge.status]
          ? html`
              <footer class="payments-foot" data-payments-actions>
                ${(MOVES[charge.status] ?? []).map(
                  (move) => html`
                    <lc-button
                      size="sm"
                      ?primary=${move.primary ?? false}
                      icon=${move.icon}
                      data-payments-move=${move.to}
                      ?disabled=${this.busy === charge.id}
                      @click=${() => void payments.move(charge.id, move.to)}
                    >${word(move.key, move.fallback)}</lc-button>
                  `,
                )}
              </footer>
            `
          : ""}
      </article>
    `;
  },
});
