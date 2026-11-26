/**
 * @file What a WhatsApp Cloud API webhook delivery means to this package: the
 * texts people sent, a person sharing their number when asked, and WhatsApp
 * moving a person to a new id or number. Delivery receipts, messages to another
 * of the business's numbers and every other kind of message are dropped here,
 * so the rest of the package never sees them. No imports, so it runs anywhere.
 */

import type { WhatsappEvent, WhatsappSender } from "./types.ts";

/** `value` as a record; anything else is empty. */
const rec = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** `value` as a list; anything else is empty. */
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** `value` as text, a number included; anything else is empty. */
const str = (value: unknown): string => (typeof value === "string" || typeof value === "number" ? String(value) : "");

/** The two letters a business-scoped id starts with, or empty. */
const countryOf = (bsuid: string): string => /^([A-Z]{2})\./.exec(bsuid)?.[1] ?? "";

/** A sender from its id, number and username. */
const senderOf = (bsuid: string, waId: string, username: string): WhatsappSender => ({ bsuid, waId, username, country: countryOf(bsuid) });

/**
 * The contact entry a message came from: the one naming its id or number, or
 * the only one there is.
 */
const contactFor = (contacts: unknown[], message: Record<string, unknown>): Record<string, unknown> => {
  const bsuid = str(message["from_user_id"]);
  const waId = str(message["from"]);
  const found = contacts.map(rec).find((c) => (bsuid !== "" && str(c["user_id"]) === bsuid) || (waId !== "" && str(c["wa_id"]) === waId));
  return found ?? (contacts.length === 1 ? rec(contacts[0]) : {});
};

/** The sender a message names, off the message and its contact entry. */
const messageSender = (message: Record<string, unknown>, contact: Record<string, unknown>): WhatsappSender =>
  senderOf(
    str(message["from_user_id"]) || str(contact["user_id"]),
    str(message["from"]) || str(contact["wa_id"]),
    str(rec(contact["profile"])["username"]),
  );

/** The event a message carries, or null for one the package ignores. */
const fromMessage = (message: Record<string, unknown>, contacts: unknown[]): WhatsappEvent | null => {
  const sender = messageSender(message, contactFor(contacts, message));
  const id = str(message["id"]);
  if (!sender.bsuid && !sender.waId) return null;
  if (message["type"] === "text") return id !== "" ? { kind: "text", id, sender, text: str(rec(message["text"])["body"]) } : null;
  if (message["type"] === "contacts") {
    const shared = list(message["contacts"])
      .map(rec)
      .find((c) => c["origin"] === "contact_request");
    const waId = shared === undefined ? "" : list(shared["phones"]).map(rec).map((p) => str(p["wa_id"])).find(Boolean) ?? "";
    return id !== "" && waId !== "" ? { kind: "contact", id, sender, waId } : null;
  }
  const system = rec(message["system"]);
  if (message["type"] === "system" && system["type"] === "user_changed_number") {
    const waId = str(system["new_wa_id"]) || str(system["wa_id"]);
    return waId !== "" ? { kind: "renumber", id, sender, bsuid: "", waId } : null;
  }
  return null;
};

/** The renumber event a `user_id_update` carries, or null. */
const fromUserIdUpdate = (update: Record<string, unknown>, contacts: unknown[]): WhatsappEvent | null => {
  const ids = rec(update["user_id"]);
  const waId = str(update["wa_id"]);
  const previous = str(ids["previous"]);
  const current = str(ids["current"]);
  if (!previous || !current) return null;
  const contact = contactFor(contacts, { from: waId });
  return { kind: "renumber", id: "", sender: senderOf(previous, waId, str(rec(contact["profile"])["username"])), bsuid: current, waId };
};

/**
 * Every event in one webhook delivery, in the order they arrived.
 *
 * @param payload the parsed body Meta posted
 * @param options `phoneNumberId`, the business number this app answers on; a change for any other is dropped
 * @returns the events the package acts on
 */
export const eventsOf = (payload: unknown, { phoneNumberId = "" }: { phoneNumberId?: string } = {}): WhatsappEvent[] => {
  const out: WhatsappEvent[] = [];
  for (const entry of list(rec(payload)["entry"]))
    for (const change of list(rec(entry)["changes"])) {
      const value = rec(rec(change)["value"]);
      if (phoneNumberId && str(rec(value["metadata"])["phone_number_id"]) !== phoneNumberId) continue;
      const contacts = list(value["contacts"]);
      for (const message of list(value["messages"])) {
        const event = fromMessage(rec(message), contacts);
        if (event) out.push(event);
      }
      for (const update of list(value["user_id_update"])) {
        const event = fromUserIdUpdate(rec(update), contacts);
        if (event) out.push(event);
      }
    }
  return out;
};
