/// <reference lib="dom" />
/**
 * @file @lightstart/mobile/page: the page's side of the Android shell. The
 * shell installs `window.__lightMobile` at document start and a `lightMobile`
 * message channel; this module speaks light's request protocol over it and
 * falls back to the web APIs outside the shell. The desktop client is
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

/** One file that arrived with a share, served under `/__mobile/`. */
export interface MobileSharedFile {
  url: string;
  type: string;
  name: string;
}

/** The share the current URL carries, from the shell or a PWA's GET share target. */
export interface MobileShared {
  text?: string;
  title?: string;
  files?: MobileSharedFile[];
}

/** One daily reminder. */
export interface MobileReminder {
  id: string;
  hour: number;
  minute: number;
  title: string;
  body: string;
  path?: string;
}

/** What `mobile.reminders` answers: `supported` is false outside a shell that has them. */
export interface MobileRemindersResult {
  supported: boolean;
}

/** What `mobile.reminders.get` answers. */
export interface MobileRemindersList extends MobileRemindersResult {
  reminders: MobileReminder[];
}

/** The daily reminders of the shell; unsupported on the web. */
export interface MobileRemindersApi {
  set(reminders: MobileReminder[]): Promise<MobileRemindersResult>;
  get(): Promise<MobileRemindersList>;
  clear(): Promise<MobileRemindersResult>;
}

/** What `mobile.capture` asks for. */
export interface MobileCaptureOptions {
  kind?: "image" | "video";
  app?: string;
}

/** The photo or clip captured, served under `/__mobile/`; null when cancelled. */
export interface MobileCaptureResult {
  url: string;
  type: string;
  name: string;
}

/** What another app asked this app for, when the shell opened a result request. */
export interface MobileResultRequest {
  kind: "capture" | "pick";
  type: string;
  output: boolean;
  /** The asking app's name, or null when the shell cannot tell. */
  from: string | null;
}

/** The page's side of answering another app's capture or pick request. */
export interface MobileResultApi {
  request(): Promise<MobileResultRequest | null>;
  answer(file: Blob | string): Promise<void>;
  cancel(): Promise<void>;
}

/** The page's mobile shell: presence, readiness, capabilities, requests and events. */
export interface MobileApi {
  readonly present: boolean;
  readonly ready: Promise<MobileReady> | null;
  can(name: string): boolean;
  request<T = unknown>(method: string, args?: unknown[]): Promise<T>;
  on(event: string, fn: (payload: unknown) => void): () => void;
  share(options: MobileShareOptions): Promise<MobileShareResult>;
  shared(): MobileShared | null;
  readonly reminders: MobileRemindersApi;
  capture(options?: MobileCaptureOptions): Promise<MobileCaptureResult | null>;
  readonly result: MobileResultApi;
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

const searchOf = (): string => {
  const location = (globalThis as unknown as { location?: { search?: string } }).location;
  return typeof location?.search === "string" ? location.search : "";
};

const shared = (): MobileShared | null => {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(searchOf());
  } catch {
    return null;
  }
  const text = params.get("text") || undefined;
  const title = params.get("title") || undefined;
  const urls = params.getAll("file");
  const types = params.getAll("type");
  const names = params.getAll("name");
  const files: MobileSharedFile[] = urls.map((url, index) => ({
    url,
    type: types[index] ?? "",
    name: names[index] ?? "",
  }));
  if (text === undefined && title === undefined && files.length === 0) return null;
  const result: MobileShared = {};
  if (text !== undefined) result.text = text;
  if (title !== undefined) result.title = title;
  if (files.length > 0) result.files = files;
  return result;
};

const reminders: MobileRemindersApi = {
  async set(list: MobileReminder[]): Promise<MobileRemindersResult> {
    if (!present || !can("reminders")) return { supported: false };
    return request<MobileRemindersResult>("reminders.set", [list]);
  },
  async get(): Promise<MobileRemindersList> {
    if (!present || !can("reminders")) return { supported: false, reminders: [] };
    return request<MobileRemindersList>("reminders.get");
  },
  async clear(): Promise<MobileRemindersResult> {
    if (!present || !can("reminders")) return { supported: false };
    return request<MobileRemindersResult>("reminders.clear");
  },
};

const captureOnWeb = (kind: "image" | "video"): Promise<MobileCaptureResult | null> => {
  const doc = (globalThis as unknown as { document?: Document }).document;
  if (doc === undefined) return Promise.reject(new Error("[mobile] capturing needs a document"));
  const input = doc.createElement("input");
  input.type = "file";
  input.accept = kind === "video" ? "video/*" : "image/*";
  input.setAttribute("capture", "environment");
  return new Promise((resolve) => {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file === undefined) {
        resolve(null);
        return;
      }
      resolve({ url: URL.createObjectURL(file), type: file.type, name: file.name });
    }, { once: true });
    input.click();
  });
};

const capture = async (options: MobileCaptureOptions = {}): Promise<MobileCaptureResult | null> => {
  const kind = options.kind ?? "image";
  if (present) return request<MobileCaptureResult | null>("capture", [{ ...options, kind }]);
  return captureOnWeb(kind);
};

const base64Of = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
};

const blobOf = async (file: Blob | string): Promise<Blob> => {
  if (typeof file !== "string") return file;
  const response = await fetch(file);
  if (!response.ok) throw new Error(`[mobile] the result file cannot be read: ${response.status}`);
  return response.blob();
};

const fileNameOf = (blob: Blob, type: string): string => {
  const name = (blob as { name?: unknown }).name;
  if (typeof name === "string" && name.trim() !== "") return name;
  const extension = type.split("/")[1]?.split("+")[0] ?? "bin";
  return `result.${extension}`;
};

const resultRequest = async (): Promise<MobileResultRequest | null> => {
  if (!present) return null;
  const value = await request<unknown>("result.request");
  if (!isRecord(value)) return null;
  const kind = value["kind"];
  const type = value["type"];
  if ((kind !== "capture" && kind !== "pick") || typeof type !== "string") return null;
  const from = value["from"];
  return { kind, type, output: value["output"] === true, from: typeof from === "string" && from !== "" ? from : null };
};

const resultAnswer = async (file: Blob | string): Promise<void> => {
  if (!present) throw new Error("[mobile] answering a result needs the mobile shell");
  const blob = await blobOf(file);
  const type = blob.type === "" ? "application/octet-stream" : blob.type;
  const data = await base64Of(blob);
  await request("result.answer", [{ data, type, name: fileNameOf(blob, type) }]);
};

const resultCancel = async (): Promise<void> => {
  if (!present) throw new Error("[mobile] cancelling a result needs the mobile shell");
  await request("result.cancel");
};

const result: MobileResultApi = { request: resultRequest, answer: resultAnswer, cancel: resultCancel };

/** The page's mobile shell, present or not. */
export const mobile: MobileApi = { present, ready: readyPromise, can, request, on, share, shared, reminders, capture, result };
