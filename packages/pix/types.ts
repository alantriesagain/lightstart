/**
 * @file The shapes `@lightstart/pix` shares between its server and its page:
 * what a BR Code is made from, a project's Pix account, and the answer the
 * charge endpoint gives the checkout.
 */

import type { ChargeRow } from "@lightstart/billing";

/** What a BR Code is made from: the account it pays (a Pix key, and the name and city it is registered under), the amount in centavos (0 for any amount) and the reference. */
export interface PixCode {
  /** The Pix key printed in every code: a random key, an email, a phone or a document. */
  key: string;
  /** The merchant name the account is registered under. */
  name: string;
  /** The merchant city the account is registered under. */
  city: string;
  /** The amount in centavos; `0` (or absent) makes a code for any amount. */
  amount?: number;
  /** The reference a payer finds in the statement, up to 25 letters and digits. */
  txid?: string;
}

/** A project's Pix account, under `providers.pix` in its billing config, or the `PIX_*` variables its server reads. */
export interface PixSettings {
  /** The Pix key payments go to. */
  key: string;
  /** The merchant name the key is registered under. */
  name: string;
  /** The merchant city the key is registered under. */
  city: string;
  /** The charge `data` fields a payment through Pix may keep. */
  data?: string[];
}

/** What `POST /api/pix/charge` answers: the charge the server recorded, and the BR Code for it. */
export interface PixCharge {
  /** The pending charge, with its amount and reference set by the server. */
  charge: ChargeRow;
  /** The EMV BR Code a bank app scans or takes pasted. */
  code: string;
}
