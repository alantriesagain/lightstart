/// <reference lib="dom" />
/**
 * @file The `push` controller: remote pushes on this device through the mobile
 * shell's `push` family and Firebase Cloud Messaging.
 *
 * - `status`: `"off"`, `"on"` once this device registered, or `"denied"` when
 *   the person refused; kept on the device.
 * - `deviceId`: the opaque id this device registers under, made once and kept
 *   on the device. A server sends to it with `sendPush(env, db, { deviceId })`.
 * - `enable()`: asks for permission (`PUSH:PERMISSION`), reads the token
 *   (`PUSH:TOKEN`) and registers it at `POST /api/push-device`, with the
 *   session when there is one; answers the state it leaves. Outside the shell
 *   it answers `{ error: "push needs the mobile shell", status: 0 }`.
 *
 * `pushToken` and `pushReceived` are the shell's occurrences, delivered as
 * events. A new token registers the device again, so an account's pushes keep
 * reaching it.
 */

import { defineController } from "@lightstart/light/controller";
import { mobile } from "@lightstart/mobile/page";
import type { PushError, PushMessage, PushPermission, PushResult, PushState, PushToken } from "../types.ts";
import { pushReceived, pushToken } from "./signals.ts";

/** The part of the mobile shell the controller speaks to; a test supplies its own. */
export interface PushShell {
  readonly present: boolean;
  request<T = unknown>(method: string, args?: unknown[]): Promise<T>;
  on(event: string, fn: (payload: unknown) => void): () => void;
}

/** The part of `localStorage` the controller keeps its own settings in; a test supplies its own. */
export interface PushStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** What `configurePush` sets: the seams a test needs, and the page's own wiring. */
export interface PushOptions {
  /** The mobile shell; the page's `mobile` when absent. */
  mobile?: PushShell;
  /** How the registration request is made; the global `fetch` when absent. */
  fetch?: typeof fetch;
  /** Where the device id and status live; `localStorage` (or memory) when absent. */
  storage?: PushStorage;
  /** The session bearer for the registration; `@lightstart/auth`'s stored token when absent. */
  token?: () => string | null;
  /** The language this device reads; its document or navigator language when absent. */
  locale?: () => string;
  /** A path placed before `/api`, such as `"/v1"`; empty when absent. */
  prefix?: string;
}

const AUTH_TOKEN_KEY = "light-auth:token";
const STATE_KEY = "push:status";
const DEVICE_KEY = "push:deviceId";

const memory = new Map<string, string>();

const memoryStorage: PushStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fallbackStorage = (): PushStorage => {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // a browser that forbids localStorage gets the memory store
  }
  return memoryStorage;
};

let configured: PushOptions = {};

/** Set the shell, fetch, storage, session or prefix the controller uses; a test's seam. */
export const configurePush = (options: PushOptions = {}): void => {
  configured = { ...configured, ...options };
};

const shell = (): PushShell => configured.mobile ?? mobile;

const fetchImpl = (): typeof fetch => configured.fetch ?? fetch;

const storage = (): PushStorage => configured.storage ?? fallbackStorage();

const prefix = (): string => {
  const raw = (configured.prefix ?? "").replace(/\/+$/, "");
  return raw === "" ? "" : raw.startsWith("/") ? raw : `/${raw}`;
};

const readSetting = (key: string): string => {
  try {
    return storage().getItem(key) ?? "";
  } catch {
    return "";
  }
};

const writeSetting = (key: string, value: string): void => {
  try {
    if (value === "") storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // storage a page forbids is a setting that does not persist
  }
};

const sessionToken = (): string | null => {
  if (configured.token !== undefined) return configured.token();
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

const localeOf = (): string => {
  if (configured.locale !== undefined) return configured.locale();
  return globalThis.document?.documentElement.lang || globalThis.navigator?.language || "";
};

const messageOf = (body: unknown, status: number): string => {
  if (isRecord(body)) {
    const error = body["error"];
    if (typeof error === "string" && error !== "") return error;
    const message = body["message"];
    if (typeof message === "string" && message !== "") return message;
  }
  return `The push registration failed (${String(status)})`;
};

const receivedOf = (payload: unknown): PushMessage | null => {
  if (!isRecord(payload)) return null;
  const id = payload["id"];
  if (typeof id !== "string" || id === "") return null;
  return {
    id,
    title: typeof payload["title"] === "string" ? payload["title"] : "",
    body: typeof payload["body"] === "string" ? payload["body"] : "",
    url: typeof payload["url"] === "string" ? payload["url"] : "",
  };
};

const tokenOf = (payload: unknown): { token: string; platform?: string } | null => {
  if (!isRecord(payload)) return null;
  const token = payload["token"];
  if (typeof token !== "string" || token === "") return null;
  const platform = payload["platform"];
  return { token, ...(typeof platform === "string" ? { platform } : {}) };
};

const push = defineController({
  name: "push",
  props: {
    available: false,
    status: "off" as PushState,
    deviceId: "",
    _registered: "",
  },

  connected() {
    this.available = shell().present;
    const stored = readSetting(STATE_KEY);
    if (stored === "on" || stored === "denied") this.status = stored;
    let deviceId = readSetting(DEVICE_KEY);
    if (deviceId === "") {
      deviceId = crypto.randomUUID();
      writeSetting(DEVICE_KEY, deviceId);
    }
    this.deviceId = deviceId;
    this.$own(
      shell().on("push:token", (payload) => {
        const token = tokenOf(payload);
        if (token !== null) pushToken.emit(token);
        void this._register();
      }),
    );
    this.$own(
      shell().on("push:received", (payload) => {
        const message = receivedOf(payload);
        if (message !== null) pushReceived.emit(message);
      }),
    );
  },

  /** Ask for permission, read this install's token and register it; answers the state it leaves. */
  async enable(): Promise<PushResult> {
    const shellApi = shell();
    if (!shellApi.present) return { error: "push needs the mobile shell", status: 0 };
    if (this.status !== "off") return { ok: true, status: this.status };
    let granted = false;
    try {
      const permission = await shellApi.request<PushPermission>("PUSH:PERMISSION");
      granted = permission !== null && permission.granted === true;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "push needs the mobile shell", status: 0 };
    }
    if (!granted) {
      this._setStatus("denied");
      return { ok: true, status: "denied" };
    }
    this._setStatus("on");
    const failed = await this._register(true);
    if (failed !== null) return failed;
    return { ok: true, status: "on" };
  },

  _setStatus(next: PushState): void {
    this.status = next;
    writeSetting(STATE_KEY, next);
  },

  async _register(force = false): Promise<PushError | null> {
    const shellApi = shell();
    if (!shellApi.present || this.status !== "on") return null;
    let answer: PushToken | null = null;
    try {
      answer = await shellApi.request<PushToken>("PUSH:TOKEN");
    } catch {
      return null;
    }
    if (answer === null || typeof answer.token !== "string" || answer.token === "") return null;
    const body = { id: this.deviceId, token: answer.token, platform: answer.platform, locale: localeOf() };
    const token = sessionToken();
    const signature = JSON.stringify([body, token]);
    if (!force && signature === this._registered) return null;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token !== null && token !== "") headers["authorization"] = `Bearer ${token}`;
    try {
      const response = await fetchImpl()(`${prefix()}/api/push-device`, { method: "POST", headers, body: JSON.stringify(body) });
      const responseBody: unknown = await response.json().catch(() => null);
      if (!response.ok) return { error: messageOf(responseBody, response.status), status: response.status };
      this._registered = signature;
      return null;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "The push registration failed", status: 0 };
    }
  },
});

export default push;
export { push };
