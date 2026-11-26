/// <reference lib="dom" />
/**
 * @file The `whatsapp` controller: ask for a connect code and follow the
 * account's connection, or sign in by asking for a login code and polling the
 * `whatsapp` identity until the device redeems it or the attempt runs out.
 * Every method answers `{ ok: true, ... } | { error, status }` and never throws
 * (a network failure is `{ error, status: 0 }`).
 */

import { auth, authFetch, authPrefix, readToken } from "@lightstart/auth/page";
import type { AuthUser } from "@lightstart/auth/server/types.ts";
import { defineController } from "@lightstart/light/controller";

import type { WhatsappState, WhatsappStatus } from "../server/types.ts";

/** Why a call failed: the server's message, and its status (0 for a network failure). */
export interface WhatsappError {
  ok?: false;
  error: string;
  status: number;
}

/** What every WhatsApp controller call answers. */
export type WhatsappResult<T extends object = Record<string, unknown>> = ({ ok: true } & T) | WhatsappError;

/** A connect code handed to a signed-in person. */
export interface WhatsappConnectCode {
  code: string;
  expiresAt: string;
  to: string;
}

/** A login code and the nonce only this device holds. */
export interface WhatsappLoginCode extends WhatsappConnectCode {
  nonce: string;
}

/** How long to wait between polls, and how long to keep trying. */
export interface WhatsappWait {
  intervalMs?: number;
  timeoutMs?: number;
}

type Outcome = ({ ok: true; body: unknown }) | WhatsappError;

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

const messageOf = (body: unknown, status: number): string => {
  if (isRecord(body)) {
    const error = body["error"];
    if (typeof error === "string" && error !== "") return error;
    const message = body["message"];
    if (typeof message === "string" && message !== "") return message;
  }
  return `The WhatsApp request failed (${String(status)})`;
};

const textOf = (body: Record<string, unknown>, field: string): string => (typeof body[field] === "string" ? String(body[field]) : "");

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

const whatsapp = defineController({
  name: "whatsapp",
  props: {
    state: "none" as WhatsappState,
    number: "",
    username: "",
    code: "",
    to: "",
    expiresAt: "",
    error: "",
  },

  async _send(method: string, path: string, options: { body?: Record<string, unknown>; auth?: boolean } = {}): Promise<Outcome> {
    const token = options.auth === true ? readToken() : null;
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers["content-type"] = "application/json";
    if (token !== null && token !== "") headers["authorization"] = `Bearer ${token}`;
    const init: RequestInit = { method, headers };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    try {
      const response = await authFetch()(`${authPrefix()}/api${path}`, init);
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (!response.ok) return { ok: false, error: messageOf(body, response.status), status: response.status };
      return { ok: true, body };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error), status: 0 };
    }
  },

  /** Ask for a connect code for the signed-in person. */
  async requestConnectCode(): Promise<WhatsappResult<WhatsappConnectCode>> {
    const result = await this._send("POST", "/whatsapp-code", { auth: true });
    if (!result.ok) return result;
    const body = isRecord(result.body) ? result.body : {};
    const code = textOf(body, "code");
    if (code === "") return { error: "The server answered no code", status: 502 };
    this.code = code;
    this.to = textOf(body, "to");
    this.expiresAt = textOf(body, "expiresAt");
    return { ok: true, code: this.code, expiresAt: this.expiresAt, to: this.to };
  },

  /** Read where connecting stands and keep it in the controller's props. */
  async refresh(): Promise<WhatsappResult<WhatsappStatus>> {
    const result = await this._send("GET", "/whatsapp-status", { auth: true });
    if (!result.ok) return result;
    const body = isRecord(result.body) ? result.body : {};
    const state = textOf(body, "state");
    this.state = state === "waiting" || state === "connected" || state === "expired" ? state : "none";
    this.number = textOf(body, "number");
    this.username = textOf(body, "username");
    return { ok: true, state: this.state, number: this.number, username: this.username };
  },

  /**
   * Ask for a connect code, then follow the account until it is connected, its
   * code runs out, or the wait ends.
   */
  async connect(options: WhatsappWait = {}): Promise<WhatsappResult<WhatsappStatus>> {
    const asked = await this.requestConnectCode();
    if (!asked.ok) return asked;
    const intervalMs = options.intervalMs ?? 3000;
    const deadline = Date.now() + (options.timeoutMs ?? 12 * 60 * 1000);
    while (Date.now() < deadline) {
      const status = await this.refresh();
      if (!status.ok) return status;
      if (status.state === "connected" || status.state === "expired") return status;
      await sleep(intervalMs);
    }
    return { error: "the WhatsApp code was not confirmed in time", status: 408 };
  },

  /**
   * Ask for a login code and nonce, then poll the `whatsapp` identity with the
   * nonce until it signs in, refuses, or the wait ends. The code and number to
   * send it to are kept in `code` and `to` while the poll runs.
   */
  async signIn(options: WhatsappWait & { deviceId?: string } = {}): Promise<WhatsappResult<{ user: AuthUser }>> {
    try {
      const body: Record<string, unknown> = {};
      if (options.deviceId !== undefined) body["deviceId"] = options.deviceId;
      const asked = await this._send("POST", "/whatsapp-login", { body });
      if (!asked.ok) return asked;
      const record = isRecord(asked.body) ? asked.body : {};
      const nonce = textOf(record, "nonce");
      const code = textOf(record, "code");
      if (nonce === "" || code === "") return { error: "The server answered no login code", status: 502 };
      this.code = code;
      this.to = textOf(record, "to");
      this.expiresAt = textOf(record, "expiresAt");

      const intervalMs = options.intervalMs ?? 3000;
      const deadline = Date.now() + (options.timeoutMs ?? 12 * 60 * 1000);
      while (Date.now() < deadline) {
        const answer = await auth.signInWithIdentity("whatsapp", { nonce });
        if ("pending" in answer) {
          await sleep(intervalMs);
          continue;
        }
        if (answer.ok === true) return { ok: true, user: answer.user };
        return { ok: false, error: answer.error, status: answer.status };
      }
      return { error: "the WhatsApp login code was not redeemed in time", status: 408 };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error), status: 0 };
    }
  },
});

export default whatsapp;
export { whatsapp };
