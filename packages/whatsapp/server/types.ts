/**
 * @file What the WhatsApp package hands around: who sent a message, what the
 * webhook made of it, what an account is connected to, and what the host may
 * do when a code is confirmed.
 */

import type { D1Like } from "@lightstart/api/server";

/**
 * How WhatsApp names the person behind a message. `bsuid` is their
 * business-scoped user id (`US.13491208655302741918`), `waId` their number as
 * WhatsApp sent it (empty when it withholds it), `country` the two letters the
 * business-scoped id starts with.
 */
export interface WhatsappSender {
  bsuid: string;
  waId: string;
  username: string;
  country: string;
}

/**
 * One thing the webhook acts on. A `text` carries what was typed; a `contact`
 * is the person sharing their own number when asked, as `waId`; a `renumber`
 * is WhatsApp moving a person to a new id or number, with `sender` as they were
 * known and `bsuid` and `waId` as they are now (either empty when it did not
 * change).
 */
export type WhatsappEvent =
  | { kind: "text"; id: string; sender: WhatsappSender; text: string }
  | { kind: "contact"; id: string; sender: WhatsappSender; waId: string }
  | { kind: "renumber"; id: string; sender: WhatsappSender; bsuid: string; waId: string };

/** What `receive` did with one event. `login` is a sign-in code arriving, which connects nothing until the device redeems it. */
export type WhatsappOutcome = "connected" | "login" | "number" | "moved" | "duplicate" | "miss" | "ignored";

/**
 * What `receive` answers for one event: the outcome, the account it touched
 * (`userId`, empty when none) and, for a login code, the push id of the device
 * that asked for it (`deviceId`, empty when it sent none).
 */
export interface WhatsappReceipt {
  outcome: WhatsappOutcome;
  userId: string;
  deviceId: string;
}

/**
 * A code confirmed, as the webhook hands it to every registered hook:
 * `connect` with the account it connected, or `login` with the device that
 * asked for the code, which is not signed in until it redeems it. `db` and
 * `env` are the webhook's own.
 */
export interface WhatsappConfirmed {
  purpose: "connect" | "login";
  userId: string;
  deviceId: string;
  env: Record<string, unknown>;
  db: D1Like;
}

/** A host's hook for a confirmed code: register it with `registerWhatsappHook`. */
export type WhatsappConfirmedHook = (confirmed: WhatsappConfirmed) => unknown;

/** Where connecting stands for an account. */
export type WhatsappState = "none" | "waiting" | "connected" | "expired";

/** What `GET /api/whatsapp-status` answers. */
export interface WhatsappStatus {
  state: WhatsappState;
  number: string;
  username: string;
}

/** The WhatsApp a session carries: the number as WhatsApp sent it (empty while it withholds it), the username and the country. */
export interface WhatsappSession {
  number: string;
  username: string;
  country: string;
}

/** A code issued, or why none was. */
export type WhatsappIssued =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; status: number; error: string };

/** A sign-in code issued to a device, with the nonce only that device holds, or why none was. */
export type WhatsappLoginIssued =
  | { ok: true; code: string; nonce: string; expiresAt: string }
  | { ok: false; status: number; error: string };

/** What `POST /api/whatsapp-login` answers: the code to send, the nonce to redeem it with, until when, and the number to send it to. */
export interface WhatsappLogin {
  code: string;
  nonce: string;
  expiresAt: string;
  to: string;
}

/** What `receive` may be handed: the `fetch` the reply goes through and the time it runs at, both for tests. */
export interface WhatsappReceiveOptions {
  fetch?: typeof fetch;
  now?: number;
}

/**
 * What `redeemLogin` answers: still waiting, no, or the account it names and
 * how to connect the sender to one. It is structurally the identity answer
 * `@lightstart/auth` serves.
 */
export type WhatsappRedeem =
  | { pending: true }
  | { error: string; status: number }
  | {
      userId: string | null;
      name?: string;
      link(userId: string): Promise<void>;
    };

/** The group an invite page names: its name and photo, or `dead` for one that names no group. */
export interface GroupInvite {
  name: string;
  image: string;
  dead: boolean;
}
