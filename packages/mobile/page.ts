/// <reference lib="dom" />
/**
 * @file @lightstart/mobile/page: the page's side of the Android shell. The
 * shell installs `window.__lightMobile` at document start and a `lightMobile`
 * message channel; this module speaks light's request protocol over it and
 * falls back to the web share API outside the shell. The desktop client is
 * deliberately not reused: it binds `window.__desktop`, carries no request id
 * and knows no capabilities.
 */

/** What the shell answers once: its platform and the capabilities it has. */
export interface MobileReady {
  platform: string;
  capabilities: string[];
}

/** One file to share, its bytes base64. */
export interface MobileShareFile {
  name: string;
  type: string;
  data: string;
}

/** What `mobile.share` takes. */
export interface MobileShareOptions {
  text?: string;
  title?: string;
  url?: string;
  files?: MobileShareFile[];
  app?: string;
}

/** What `mobile.share` answers once the sheet was opened or the target named. */
export interface MobileShareResult {
  shared: boolean;
}

/** The page's mobile shell: presence, readiness, capabilities, requests and events. */
export interface MobileApi {
  readonly present: boolean;
  readonly ready: Promise<MobileReady> | null;
  can(name: string): boolean;
  request<T = unknown>(method: string, args?: unknown[]): Promise<T>;
  on(event: string, fn: (payload: unknown) => void): () => void;
  share(options: MobileShareOptions): Promise<MobileShareResult>;
}

interface ShellEvent {
  data: unknown;
}

interface ShellChannel {
  postMessage(text: string): void;
  addEventListener(type: "message", listener: (event: ShellEvent) => void): void;
  removeEventListener(type: "message", listener: (event: ShellEvent) => void): void;
}

interface ShellWindow {
  __lightMobile?: { present?: boolean };
  lightMobile?: ShellChannel;
}

interface Message {
  id?: unknown;
  ok?: unknown;
  value?: unknown;
  error?: unknown;
  event?: unknown;
  payload?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const root = globalThis as unknown as ShellWindow;
const channel = root.lightMobile;
const present = root.__lightMobile?.present === true && channel !== undefined && typeof channel.postMessage === "function";

const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: unknown) => void }>();
const listeners = new Map<string, Set<(payload: unknown) => void>>();
let nextId = 1;
let capabilities: string[] = [];

const messageOf = (data: unknown): Message => {
  let value = data;
  if (typeof data === "string") {
    try {
      value = JSON.parse(data);
    } catch {
      return {};
    }
  }
  return isRecord(value) ? value : {};
};

const receive = (event: ShellEvent): void => {
  const message = messageOf(event.data);
  if (typeof message.id === "number" || typeof message.id === "string") {
    const id = Number(message.id);
    const entry = pending.get(id);
    if (entry === undefined) return;
    pending.delete(id);
    if (message.ok === true) entry.resolve(message.value);
    else entry.reject(new Error(typeof message.error === "string" ? message.error : "mobile call failed"));
    return;
  }
  if (typeof message.event !== "string") return;
  const set = listeners.get(message.event);
  if (set === undefined) return;
  for (const fn of [...set]) fn(message.payload);
};

const request = <T>(method: string, args: unknown[] = []): Promise<T> => {
  if (!present || channel === undefined) return Promise.reject(new Error("[mobile] this page is not running inside a mobile shell"));
  const id = nextId;
  nextId += 1;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: (value) => resolve(value as T), reject });
    try {
      channel.postMessage(JSON.stringify([id, method, args]));
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  });
};

if (present && channel !== undefined) channel.addEventListener("message", receive);

const readyPromise: Promise<MobileReady> | null = present
  ? request<MobileReady>("$ready").then((value) => {
      capabilities = Array.isArray(value.capabilities) ? value.capabilities : [];
      return value;
    })
  : null;
if (readyPromise !== null) void readyPromise.catch(() => undefined);

const can = (name: string): boolean => present && capabilities.includes(name);

const on = (event: string, fn: (payload: unknown) => void): (() => void) => {
  let set = listeners.get(event);
  if (set === undefined) {
    set = new Set();
    listeners.set(event, set);
  }
  const current = set;
  current.add(fn);
  return () => {
    current.delete(fn);
  };
};

const fileOf = (file: MobileShareFile): File => {
  const binary = atob(file.data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], file.name, { type: file.type });
};

const share = async (options: MobileShareOptions): Promise<MobileShareResult> => {
  if (present) return request<MobileShareResult>("share", [options]);
  const nav = (globalThis as unknown as { navigator?: Navigator }).navigator;
  if (nav === undefined || typeof nav.share !== "function") throw new Error("[mobile] sharing is not available here");
  const data: ShareData = {};
  if (options.title !== undefined) data.title = options.title;
  if (options.text !== undefined) data.text = options.text;
  if (options.url !== undefined) data.url = options.url;
  if (options.files !== undefined && options.files.length > 0) data.files = options.files.map(fileOf);
  await nav.share(data);
  return { shared: true };
};

/** The page's mobile shell, present or not. */
export const mobile: MobileApi = { present, ready: readyPromise, can, request, on, share };
