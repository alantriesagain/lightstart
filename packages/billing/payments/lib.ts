/**
 * @file Payments as data: the tabs a charge is listed under, money written
 * the way a person reads it, what a charge pays for, what to look for on a
 * bank statement, and the period a charge granted.
 */

import { msOf } from "../lib/ledger.ts";

import type { ChargeRow, EntitlementRow } from "../types.ts";

/** The tabs, each the charges in one status. */
export const TABS = [
  { id: "to-match", status: "pending", word: "payments-page.toMatch", label: "To match" },
  { id: "paid", status: "paid", word: "payments-page.paid", label: "Paid" },
  { id: "canceled", status: "canceled", word: "payments-page.canceled", label: "Canceled" },
  { id: "refunded", status: "refunded", word: "payments-page.refunded", label: "Refunded" },
] as const;

/** The tab a charge in `status` is listed under. */
export const tabOfStatus = (status: string): string => TABS.find((tab) => tab.status === status)?.id ?? "to-match";

/**
 * Money as a person reads it: whole units when there are no cents (`R$ 49`),
 * the cents when there are, and always the cents for a statement.
 */
export const money = (cents: number, currency: string, { cents: always = false } = {}): string => {
  const code = currency === "" ? "BRL" : currency;
  const whole = !always && cents % 100 === 0;
  return new Intl.NumberFormat(code === "BRL" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })
    .format(cents / 100)
    .replace(/\u00a0/g, " ");
};

/** A plan's name the way the list writes it. */
export const planLabel = (plan: string): string => (plan === "" ? "" : plan[0]?.toUpperCase() + plan.slice(1));

/** What a charge pays for, in the words the list uses. */
export const forWhat = (charge: Pick<ChargeRow, "plan" | "context">): string => {
  const kind = charge.context.kind ?? "";
  const slug = charge.context.slug ?? "";
  if (kind === "") return planLabel(charge.plan);
  const label = planLabel(kind);
  return slug === "" ? label : `${label} · ${slug}`;
};

/** A date the way the lists write it: `Sep 29`, or `Sep 29 11:02` with the time. */
export const dateOf = (text: unknown, { time = false, timeZone }: { time?: boolean; timeZone?: string } = {}): string => {
  const ms = msOf(text);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(time ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
    ...(timeZone === undefined ? {} : { timeZone }),
  })
    .format(new Date(ms))
    .replace(",", "");
};

/** The period a charge granted, if it granted one. */
export const periodOf = (charge: Pick<ChargeRow, "id">, entitlements: EntitlementRow[]): EntitlementRow | null =>
  entitlements.find((row) => row.source === "charge" && row.ref === charge.id) ?? null;

/** What to look for on the bank statement to match a charge that waits. */
export const statementOf = (charge: ChargeRow): { amount: string; payer: string; reference: string } | null => {
  if (charge.status !== "pending") return null;
  const payer = String(charge.data["payer"] ?? "").trim().toUpperCase();
  return { amount: money(charge.amount, charge.currency, { cents: true }), payer, reference: charge.providerRef.slice(0, 10) };
};
