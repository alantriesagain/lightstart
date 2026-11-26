/**
 * @file Connecting an account to WhatsApp, and signing in with it, on the
 * server. A signed-in person is issued a six-digit code and sends it from their
 * own WhatsApp; the webhook hands what Meta delivered to `receive`, which
 * matches the code and records the sender against that account. A device
 * signing in is issued a code and a nonce instead; the webhook stamps the
 * sender on that code, and the device redeems it once through the `whatsapp`
 * identity the auth core serves. Every call reads and writes the D1-shaped
 * database through `@lightstart/api/server`'s `D1Like`, so the same code runs
 * on a Worker's binding and on a local SQLite file.
 */

import type { D1Like } from "@lightstart/api/server";

import type {
  WhatsappEvent,
  WhatsappIssued,
  WhatsappLoginIssued,
  WhatsappOutcome,
  WhatsappReceipt,
  WhatsappReceiveOptions,
  WhatsappRedeem,
  WhatsappSender,
  WhatsappSession,
  WhatsappStatus,
} from "./types.ts";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const CODE_TTL = 10 * MINUTE;
const CODES_PER_HOUR = 5;
const LOGINS_PER_HOUR = 10;
const LOGINS_OPEN = 500;
const MISSES_PER_HOUR = 5;
const KEEP_MESSAGES = 7 * DAY;

const GRAPH = "https://graph.facebook.com/v24.0";
const ASK_TEXT = "Share your number to finish connecting.";

const CODE_IN_TEXT = /(?<![\p{L}\p{N}_])\d{6}(?![\p{L}\p{N}_])/gu;
const NONCE = /^[A-Za-z0-9_-]{32,64}$/;
const DEVICE = /^[A-Za-z0-9_-]{16,64}$/;

/** A moment as the ISO text a table keeps. */
const iso = (ms: number): string => new Date(ms).toISOString();

/** A row field as text. */
const str = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

/** A row field as a number. */
const num = (value: unknown): number => Number(value ?? 0);

/** A receipt with the account or device left empty unless named. */
const receipt = (outcome: WhatsappOutcome, who: { userId?: string; deviceId?: string } = {}): WhatsappReceipt => ({
  outcome,
  userId: who.userId ?? "",
  deviceId: who.deviceId ?? "",
});

/** Six random digits, no value above the largest multiple of a million wasted. */
const drawCode = (): string => {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return (n ?? 0) >= 4_294_000_000 ? drawCode() : String((n ?? 0) % 1_000_000).padStart(6, "0");
};

/** A URL-safe random nonce a device keeps and the table only digests. */
const drawNonce = (): string =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** The lowercase hex SHA-256 of `text`. */
const digest = async (text: string): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * The key an account holds its sender under: the business-scoped id, or the
 * number with a `+` when WhatsApp sent no id.
 *
 * @param sender who sent the message
 * @returns the key `whatsapp_account.sender` carries
 */
export const senderKey = ({ bsuid, waId }: WhatsappSender): string => bsuid || (waId ? `+${waId}` : "");

/** How many rows a write changed. */
const changes = (result: { meta?: { changes?: number } }): number => Number(result.meta?.changes ?? 0);

/**
 * A code value no code took in the last day, so a code names one account or
 * one device; null when twenty draws in a row were taken.
 */
const freeCode = async (db: D1Like, now: number): Promise<string | null> => {
  const since = iso(now - DAY - CODE_TTL);
  for (let tries = 0; tries <= 20; tries++) {
    const code = drawCode();
    const taken = await db.prepare("SELECT 1 AS taken FROM whatsapp_code WHERE code = ? AND created > ?").bind(code, since).first();
    if (taken === null) return code;
  }
  return null;
};

/**
 * A new code for `userId` to connect with, good for ten minutes. It ends the
 * codes the person was handed before, refuses a sixth in an hour, and never
 * hands out a value any code took in the last day.
 *
 * @param db the D1-shaped database
 * @param userId the signed-in account
 * @param now the clock, `Date.now()` by default
 * @returns the code and when it runs out, or why none was issued
 */
export const issueCode = async (db: D1Like, userId: string, now: number = Date.now()): Promise<WhatsappIssued> => {
  const recent = await db
    .prepare("SELECT count(*) AS n FROM whatsapp_code WHERE userId = ? AND purpose = 'connect' AND created > ?")
    .bind(userId, iso(now - HOUR))
    .first();
  if (num(recent?.["n"]) >= CODES_PER_HOUR) return { ok: false, status: 429, error: "too many codes, try again later" };
  const code = await freeCode(db, now);
  if (code === null) return { ok: false, status: 503, error: "no code free, try again" };
  const at = iso(now);
  const expiresAt = iso(now + CODE_TTL);
  await db
    .prepare("UPDATE whatsapp_code SET expiresAt = ? WHERE userId = ? AND purpose = 'connect' AND usedAt = '' AND expiresAt > ?")
    .bind(at, userId, at)
    .run();
  await db
    .prepare("INSERT INTO whatsapp_code (id, userId, code, expiresAt, usedAt, sender, purpose, created) VALUES (?, ?, ?, ?, '', '', 'connect', ?)")
    .bind(crypto.randomUUID(), userId, code, expiresAt, at)
    .run();
  return { ok: true, code, expiresAt };
};

/**
 * A code for a device to sign in with, good for ten minutes, and the nonce
 * only that device holds: the row keeps the nonce's digest, never the nonce.
 * Ten an hour from one address, and no more than five hundred waiting at once.
 * Login codes a day old are swept. `deviceId` is the id the device registered
 * for pushes under, when it has one (16 to 64 letters, digits, `-` or `_`,
 * anything else kept as none), handed back when the code arrives so the host
 * can tell that device.
 *
 * @param db the D1-shaped database
 * @param ipHash the salted digest of the address asking
 * @param options the device id and the clock
 * @returns the code, the nonce and when it runs out, or why none was issued
 */
export const issueLogin = async (
  db: D1Like,
  ipHash: string,
  { deviceId = "", now = Date.now() }: { deviceId?: unknown; now?: number } = {},
): Promise<WhatsappLoginIssued> => {
  const at = iso(now);
  await db.prepare("DELETE FROM whatsapp_code WHERE purpose = 'login' AND created < ?").bind(iso(now - DAY - CODE_TTL)).run();
  const recent = await db
    .prepare("SELECT count(*) AS n FROM whatsapp_code WHERE purpose = 'login' AND ipHash = ? AND created > ?")
    .bind(ipHash, iso(now - HOUR))
    .first();
  if (num(recent?.["n"]) >= LOGINS_PER_HOUR) return { ok: false, status: 429, error: "too many codes, try again later" };
  const open = await db
    .prepare("SELECT count(*) AS n FROM whatsapp_code WHERE purpose = 'login' AND usedAt = '' AND expiresAt > ?")
    .bind(at)
    .first();
  if (num(open?.["n"]) >= LOGINS_OPEN) return { ok: false, status: 503, error: "too many codes waiting, try again" };
  const code = await freeCode(db, now);
  if (code === null) return { ok: false, status: 503, error: "no code free, try again" };
  const nonce = drawNonce();
  const expiresAt = iso(now + CODE_TTL);
  await db
    .prepare(
      "INSERT INTO whatsapp_code (id, userId, code, expiresAt, usedAt, sender, purpose, nonceHash, ipHash, redeemedAt, deviceId, created) VALUES (?, '', ?, ?, '', '', 'login', ?, ?, '', ?, ?)",
    )
    .bind(crypto.randomUUID(), code, expiresAt, await digest(nonce), ipHash, typeof deviceId === "string" && DEVICE.test(deviceId) ? deviceId : "", at)
    .run();
  return { ok: true, code, nonce, expiresAt };
};

/**
 * Where connecting stands for `userId`: a code waiting to be sent (a connected
 * account asking for another included, so a new number is waited for rather
 * than the old one reported), connected, the last code run out, or nothing
 * asked for.
 *
 * @param db the D1-shaped database
 * @param userId the signed-in account
 * @param now the clock, `Date.now()` by default
 * @returns the state, and the number and username once connected
 */
export const codeStatus = async (db: D1Like, userId: string, now: number = Date.now()): Promise<WhatsappStatus> => {
  const last = await db
    .prepare("SELECT expiresAt, usedAt FROM whatsapp_code WHERE userId = ? AND purpose = 'connect' ORDER BY created DESC LIMIT 1")
    .bind(userId)
    .first();
  const open = last !== null && str(last["usedAt"]) === "";
  if (open && str(last["expiresAt"]) > iso(now)) return { state: "waiting", number: "", username: "" };
  const account = await db.prepare("SELECT waId, username FROM whatsapp_account WHERE id = ?").bind(userId).first();
  if (account !== null) return { state: "connected", number: str(account["waId"]), username: str(account["username"]) };
  return { state: open ? "expired" : "none", number: "", username: "" };
};

/** Takes `sender` and `waId` off every account but `userId`, so the newest confirmation holds them. */
const takeOff = (db: D1Like, userId: string, sender: string, waId: string): Promise<unknown> =>
  db
    .prepare("DELETE FROM whatsapp_account WHERE id != ? AND (sender = ? OR (? != '' AND waId = ?))")
    .bind(userId, sender, waId, waId)
    .run();

/**
 * Records `sender` as the WhatsApp `userId` is connected to, taking it off any
 * other account, and asks for the number when WhatsApp sent none and the
 * account holds none.
 */
const connectAccount = async (db: D1Like, userId: string, sender: WhatsappSender, at: string, env: Record<string, unknown>, send: typeof fetch): Promise<void> => {
  const key = senderKey(sender);
  await takeOff(db, userId, key, sender.waId);
  await db
    .prepare(
      `INSERT INTO whatsapp_account (id, userId, sender, waId, username, country, connectedAt) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         waId = CASE WHEN excluded.waId != '' THEN excluded.waId WHEN whatsapp_account.sender = excluded.sender THEN whatsapp_account.waId ELSE '' END,
         sender = excluded.sender, username = excluded.username, country = excluded.country, connectedAt = excluded.connectedAt`,
    )
    .bind(userId, userId, key, sender.waId, sender.username, sender.country, at)
    .run();
  const held = await db.prepare("SELECT waId FROM whatsapp_account WHERE id = ?").bind(userId).first();
  if (str(held?.["waId"]) === "") await askNumber(env, sender, send);
};

/**
 * Asks a person WhatsApp sent no number for to share it, with the
 * `request_contact_info` reply. Needs `WHATSAPP_TOKEN` and
 * `WHATSAPP_PHONE_NUMBER_ID`; the wording is `WHATSAPP_ASK_TEXT` when set.
 *
 * @param env the server's environment
 * @param sender who to ask
 * @param send the fetch the reply goes through
 * @returns whether Meta accepted the reply
 */
const askNumber = async (env: Record<string, unknown>, sender: WhatsappSender, send: typeof fetch): Promise<boolean> => {
  const token = str(env["WHATSAPP_TOKEN"]);
  const phoneNumberId = str(env["WHATSAPP_PHONE_NUMBER_ID"]);
  if (!token || !phoneNumberId || !sender.bsuid) return false;
  const res = await send(`${GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      recipient: sender.bsuid,
      type: "interactive",
      interactive: { type: "request_contact_info", body: { text: str(env["WHATSAPP_ASK_TEXT"]) || ASK_TEXT }, action: { name: "request_contact_info" } },
    }),
  }).catch(() => null);
  return res?.ok === true;
};

/** Whether this is the first time the message was seen, by its WhatsApp id. */
const firstSight = async (db: D1Like, id: string, sender: string, matched: number, now: number): Promise<boolean> =>
  changes(await db.prepare("INSERT OR IGNORE INTO whatsapp_message (id, sender, matched, created) VALUES (?, ?, ?, ?)").bind(id, sender, matched, iso(now)).run()) === 1;

/** Acts on one text: a code sent connects the account it was issued to, or stamps a login code. */
const receiveText = async (
  db: D1Like,
  event: Extract<WhatsappEvent, { kind: "text" }>,
  env: Record<string, unknown>,
  send: typeof fetch,
  now: number,
): Promise<WhatsappReceipt> => {
  const sender = senderKey(event.sender);
  if (!(await firstSight(db, event.id, sender, 0, now))) return receipt("duplicate");
  const misses = await db
    .prepare("SELECT count(*) AS n FROM whatsapp_message WHERE sender = ? AND matched = 0 AND created > ? AND id != ?")
    .bind(sender, iso(now - HOUR), event.id)
    .first();
  if (num(misses?.["n"]) >= MISSES_PER_HOUR) return receipt("ignored");

  const at = iso(now);
  for (const [code] of event.text.matchAll(CODE_IN_TEXT)) {
    const row = await db
      .prepare("SELECT id, userId, purpose, deviceId FROM whatsapp_code WHERE code = ? AND usedAt = '' AND expiresAt > ? ORDER BY created DESC LIMIT 1")
      .bind(code, at)
      .first();
    if (row === null) continue;
    const { waId, username, country } = event.sender;
    const stamp = "UPDATE whatsapp_code SET usedAt = ?, sender = ?, waId = ?, username = ?, country = ? WHERE id = ? AND usedAt = ''";
    if (changes(await db.prepare(stamp).bind(at, sender, waId, username, country, row["id"]).run()) !== 1) continue;
    await db.prepare("UPDATE whatsapp_message SET matched = 1 WHERE id = ?").bind(event.id).run();
    if (row["purpose"] === "login") return receipt("login", { deviceId: str(row["deviceId"]) });
    await connectAccount(db, str(row["userId"]), event.sender, at, env, send);
    return receipt("connected", { userId: str(row["userId"]) });
  }
  return receipt("miss");
};

/** Acts on a contact the person shared when asked, filling in the account's number. */
const receiveContact = async (db: D1Like, event: Extract<WhatsappEvent, { kind: "contact" }>, now: number): Promise<WhatsappReceipt> => {
  const sender = senderKey(event.sender);
  if (!(await firstSight(db, event.id, sender, 1, now))) return receipt("duplicate");
  const account = await db.prepare("SELECT id FROM whatsapp_account WHERE sender = ?").bind(sender).first();
  if (account === null) return receipt("ignored");
  const userId = str(account["id"]);
  await takeOff(db, userId, `+${event.waId}`, event.waId);
  await db.prepare("UPDATE whatsapp_account SET waId = ? WHERE id = ?").bind(event.waId, userId).run();
  return receipt("number", { userId });
};

/** Acts on WhatsApp moving a person to a new business-scoped id or number. */
const receiveRenumber = async (db: D1Like, event: Extract<WhatsappEvent, { kind: "renumber" }>): Promise<WhatsappReceipt> => {
  const known = [event.sender.bsuid, event.sender.waId ? `+${event.sender.waId}` : ""].filter(Boolean);
  const account = known.length
    ? await db
        .prepare(`SELECT id, sender, waId FROM whatsapp_account WHERE sender IN (${known.map(() => "?").join(", ")}) LIMIT 1`)
        .bind(...known)
        .first()
    : null;
  if (account === null) return receipt("ignored");
  const userId = str(account["id"]);
  const was = str(account["sender"]);
  const waId = event.waId || str(account["waId"]);
  const sender = event.bsuid || (was.startsWith("+") && event.waId ? `+${event.waId}` : was);
  await takeOff(db, userId, sender, waId);
  await db.prepare("UPDATE whatsapp_account SET sender = ?, waId = ? WHERE id = ?").bind(sender, waId, userId).run();
  return receipt("moved", { userId });
};

/**
 * Acts on what one webhook delivery carried, in order: a code sent connects the
 * account it was issued to, or, for a code a device asked for to sign in, is
 * stamped with who sent it and connects nothing until the device redeems it; a
 * number shared when asked fills in the account's number, and WhatsApp moving a
 * person moves their account. A message seen before is dropped, and a sender
 * whose last five texts in an hour matched no code is not listened to for the
 * rest of it. Messages older than a week are swept.
 *
 * @param db the D1-shaped database
 * @param events what `eventsOf` made of the delivery
 * @param env `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` for the reply asking for a number
 * @param options the fetch the reply goes through and the clock, for tests
 * @returns what became of each event
 */
export const receive = async (
  db: D1Like,
  events: WhatsappEvent[],
  env: Record<string, unknown>,
  { fetch: send = globalThis.fetch, now = Date.now() }: WhatsappReceiveOptions = {},
): Promise<WhatsappReceipt[]> => {
  await db.prepare("DELETE FROM whatsapp_message WHERE created < ?").bind(iso(now - KEEP_MESSAGES)).run();
  const outcomes: WhatsappReceipt[] = [];
  for (const event of events)
    outcomes.push(
      event.kind === "text"
        ? await receiveText(db, event, env, send, now)
        : event.kind === "contact"
          ? await receiveContact(db, event, now)
          : await receiveRenumber(db, event),
    );
  return outcomes;
};

/**
 * The WhatsApp an account is connected to, for its session, or null.
 *
 * @param userId the signed-in account, or nothing
 * @param db the D1-shaped database
 * @returns the number, username and country, or null when not connected
 */
export const whatsappSession = async (userId: string | undefined, db: D1Like): Promise<WhatsappSession | null> => {
  if (!userId) return null;
  const row = await db.prepare("SELECT waId, username, country FROM whatsapp_account WHERE id = ?").bind(userId).first();
  return row === null ? null : { number: str(row["waId"]), username: str(row["username"]), country: str(row["country"]) };
};

/**
 * Redeems the login code a device holds the nonce of, once: still waiting until
 * the code arrives, refused when it ran out, was redeemed, or came from a
 * sender WhatsApp named only by a number (a number can pass to somebody else,
 * so it never signs into an account). Otherwise the account the sender is
 * connected to, or nobody yet, and how to connect the sender to an account.
 *
 * @param db the D1-shaped database
 * @param nonce the nonce the device kept
 * @param env `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` for the reply asking for a number
 * @param options the fetch the reply goes through and the clock, for tests
 * @returns waiting, a refusal, or the account and how to link one
 */
export const redeemLogin = async (
  db: D1Like,
  nonce: unknown,
  env: Record<string, unknown> = {},
  { fetch: send = globalThis.fetch, now = Date.now() }: WhatsappReceiveOptions = {},
): Promise<WhatsappRedeem> => {
  if (typeof nonce !== "string" || !NONCE.test(nonce)) return { error: "no such code", status: 404 };
  const row = await db
    .prepare("SELECT id, created, usedAt, redeemedAt, sender, waId, username, country FROM whatsapp_code WHERE purpose = 'login' AND nonceHash = ?")
    .bind(await digest(nonce))
    .first();
  if (row === null) return { error: "no such code", status: 404 };
  if (str(row["redeemedAt"]) !== "") return { error: "that code was used", status: 410 };
  if (Date.parse(str(row["created"])) + CODE_TTL <= now) return { error: "that code ran out", status: 410 };
  if (str(row["usedAt"]) === "") return { pending: true };
  const key = str(row["sender"]);
  if (!key || key.startsWith("+")) return { error: "WhatsApp did not say who sent it", status: 422 };
  const at = iso(now);
  if (changes(await db.prepare("UPDATE whatsapp_code SET redeemedAt = ? WHERE id = ? AND redeemedAt = ''").bind(at, row["id"]).run()) !== 1)
    return { error: "that code was used", status: 410 };
  const sender: WhatsappSender = { bsuid: key, waId: str(row["waId"]), username: str(row["username"]), country: str(row["country"]) };
  const account = await db.prepare("SELECT id FROM whatsapp_account WHERE sender = ?").bind(key).first();
  return {
    userId: account === null ? null : str(account["id"]),
    name: sender.username,
    link: async (userId: string): Promise<void> => connectAccount(db, userId, sender, at, env, send),
  };
};

/**
 * Signing in with WhatsApp, as the auth core's identity source: the body
 * carries the nonce `POST /api/whatsapp-login` handed the device.
 */
export const whatsappLogin = {
  redeem: (body: unknown, db: D1Like, env: Record<string, unknown>): Promise<WhatsappRedeem> =>
    redeemLogin(db, body !== null && typeof body === "object" ? (body as Record<string, unknown>)["nonce"] : undefined, env),
};

/**
 * What deleting an account does here: its connection, its codes, the codes it
 * signed in with and the messages its sender sent go.
 *
 * @param userId the verified account
 * @param db the D1-shaped database
 */
export const forgetWhatsapp = async (userId: string | undefined, db: D1Like): Promise<void> => {
  if (!userId) return;
  const account = await db.prepare("SELECT sender FROM whatsapp_account WHERE id = ?").bind(userId).first();
  const sender = str(account?.["sender"]);
  if (sender !== "") {
    await db.prepare("DELETE FROM whatsapp_message WHERE sender = ?").bind(sender).run();
    await db.prepare("DELETE FROM whatsapp_code WHERE purpose = 'login' AND sender = ?").bind(sender).run();
  }
  await db.prepare("DELETE FROM whatsapp_account WHERE id = ?").bind(userId).run();
  await db.prepare("DELETE FROM whatsapp_code WHERE userId = ?").bind(userId).run();
};
