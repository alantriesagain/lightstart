/**
 * @file The files a tool reads and writes: project-relative paths inside the
 * folders `src/admin` allows, through a pluggable `FilesBackend`. The default
 * backend is the dev file API `light serve` mounts; a later GitHub backend
 * implements the same interface. Every path is checked before a request is
 * made, and `changed` is bumped after a write, a delete, or a dev-server file
 * change inside an allowed folder.
 */

import { signal } from "@lightstart/light/signals";
import type { Signal } from "@lightstart/light/signals";
import { assertPath, withinFolder } from "./paths.ts";
import { adminTitle } from "./state.ts";

/** One entry of a listing. */
export interface FileEntry {
  path: string;
  name: string;
  kind: "file" | "dir";
  size: number;
  modified: number;
}

/** What the dev file API answers at `/__admin/session`. */
export interface AdminSession {
  token: string;
  folders: readonly string[];
  title: string;
}

/** The store a tool reads and writes through; the dev file API is the default, GitHub can be another. */
export interface FilesBackend {
  read(path: string): Promise<string | null>;
  readBlob(path: string): Promise<Blob | null>;
  write(path: string, content: string | Blob): Promise<void>;
  delete(path: string): Promise<void>;
  list(dir: string): Promise<FileEntry[]>;
  exists(path: string): Promise<boolean>;
  session?(): Promise<AdminSession>;
}

/** Every write or delete through the API, and every dev-server change in an allowed folder. */
export const changed: Signal<number> = signal(0);

const bump = (): void => {
  changed.value += 1;
};

const SESSION_PATH = "/__admin/session";
const FILES_PATH = "/__admin/files";
const LIST_PATH = "/__admin/list";
const TOKEN_HEADER = "x-light-admin-token";

const url = (path: string, base: string): string => `${base}?path=${encodeURIComponent(path)}`;

/** The dev file API as a `FilesBackend`: the session's token stays in memory, never in storage. */
export class DevFilesBackend implements FilesBackend {
  private sessionPromise: Promise<AdminSession> | null = null;
  private folders: readonly string[] = [];
  private socket: WebSocket | null = null;

  async session(): Promise<AdminSession> {
    const session = await this.openSession();
    return session;
  }

  private openSession(): Promise<AdminSession> {
    if (this.sessionPromise !== null) return this.sessionPromise;
    this.sessionPromise = (async (): Promise<AdminSession> => {
      const response = await fetch(SESSION_PATH, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`The admin session was refused (${String(response.status)})`);
      const data = (await response.json()) as Partial<AdminSession>;
      const session: AdminSession = {
        token: typeof data.token === "string" ? data.token : "",
        folders: Array.isArray(data.folders) ? data.folders.filter((folder): folder is string => typeof folder === "string") : [],
        title: typeof data.title === "string" && data.title.trim() !== "" ? data.title : "Admin",
      };
      this.folders = session.folders;
      adminTitle.value = session.title;
      this.watch();
      return session;
    })();
    return this.sessionPromise;
  }

  private watch(): void {
    if (this.socket !== null || typeof WebSocket === "undefined" || typeof location === "undefined") return;
    try {
      const protocol = location.protocol === "https:" ? "wss://" : "ws://";
      const socket = new WebSocket(protocol + location.host);
      this.socket = socket;
      socket.addEventListener("message", (event: MessageEvent<unknown>) => {
        if (typeof event.data !== "string") return;
        let data: unknown;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (typeof data !== "object" || data === null) return;
        const record = data as { type?: unknown; path?: unknown };
        if (record.type !== "file-changed" || typeof record.path !== "string") return;
        if (this.folders.some((folder) => withinFolder(record.path as string, folder))) bump();
      });
      socket.addEventListener("error", () => {});
    } catch {
      this.socket = null;
    }
  }

  private async token(): Promise<string> {
    return (await this.openSession()).token;
  }

  private async allowed(path: string): Promise<void> {
    const session = await this.openSession();
    if (!session.folders.some((folder) => withinFolder(path, folder))) throw new Error(`The admin path "${path}" is outside the folders the project allows`);
  }

  private async request(method: string, path: string, init: RequestInit = {}): Promise<Response> {
    await this.allowed(path);
    const token = await this.token();
    return await fetch(url(path, FILES_PATH), {
      ...init,
      method,
      credentials: "same-origin",
      headers: { ...(init.headers ?? {}), [TOKEN_HEADER]: token },
    });
  }

  async read(path: string): Promise<string | null> {
    const response = await this.request("GET", path);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Reading "${path}" was refused (${String(response.status)})`);
    return await response.text();
  }

  async readBlob(path: string): Promise<Blob | null> {
    const response = await this.request("GET", path);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Reading "${path}" was refused (${String(response.status)})`);
    return await response.blob();
  }

  async write(path: string, content: string | Blob): Promise<void> {
    const response = await this.request("PUT", path, { body: content });
    if (!response.ok) throw new Error(`Writing "${path}" was refused (${String(response.status)})`);
  }

  async delete(path: string): Promise<void> {
    const response = await this.request("DELETE", path);
    if (!response.ok) throw new Error(`Deleting "${path}" was refused (${String(response.status)})`);
  }

  async list(dir: string): Promise<FileEntry[]> {
    await this.allowed(dir);
    const token = await this.token();
    const response = await fetch(url(dir, LIST_PATH), { credentials: "same-origin", headers: { [TOKEN_HEADER]: token } });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`Listing "${dir}" was refused (${String(response.status)})`);
    const data = (await response.json()) as unknown;
    return Array.isArray(data) ? (data as FileEntry[]) : [];
  }

  async exists(path: string): Promise<boolean> {
    const response = await this.request("HEAD", path);
    return response.status === 200;
  }
}

let backend: FilesBackend = new DevFilesBackend();

/** Use another backend (a test's, or a later GitHub one); the default is the dev file API. */
export const configureFiles = (next: FilesBackend): void => {
  backend = next;
};

/** Read the title and folders the backend's session answers, when it has one; the shell calls it once. */
export const loadAdminSession = async (): Promise<void> => {
  if (backend.session === undefined) return;
  try {
    await backend.session();
  } catch {
    // A page without the dev server (a build preview) keeps the default title and folders.
  }
};

/** The files a tool reads and writes; each method validates its path before the backend sees it. */
export const files = {
  changed: changed,

  async read(path: string): Promise<string | null> {
    assertPath(path);
    return await backend.read(path);
  },

  async readBlob(path: string): Promise<Blob | null> {
    assertPath(path);
    return await backend.readBlob(path);
  },

  async write(path: string, content: string | Blob): Promise<void> {
    assertPath(path);
    await backend.write(path, content);
    bump();
  },

  async delete(path: string): Promise<void> {
    assertPath(path);
    await backend.delete(path);
    bump();
  },

  async list(dir: string): Promise<FileEntry[]> {
    assertPath(dir);
    return await backend.list(dir);
  },

  async exists(path: string): Promise<boolean> {
    assertPath(path);
    return await backend.exists(path);
  },
};
