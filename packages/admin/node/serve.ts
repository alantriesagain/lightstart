/**
 * @file The guarded dev file API `light serve` mounts: the session with its
 * per-run token, reading, writing, deleting and listing inside the folders
 * `src/admin` allows. Every request must come to a loopback host; a file or
 * listing request needs the token, a state-changing one too; the session needs
 * a same-origin request with no cross-site fetch metadata. Paths are checked
 * and resolved through symlinks inside an allowed folder, writes are atomic,
 * and a body over the cap is 413. A file is answered with `nosniff` and
 * `no-store`; a listing leaves out dot-entries, which no admin path may name.
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { App, bytes, empty, fail, HttpError, json } from "@lightstart/server";
import type { Context, Reply } from "@lightstart/server";
import { pathProblem, withinFolder } from "../paths.ts";

/** The most bytes a write may carry: 200 MiB. */
export const ADMIN_BODY_LIMIT = 200 * 1024 * 1024;

/** The header a file or listing request carries the session token in. */
export const ADMIN_TOKEN_HEADER = "x-light-admin-token";

/** What the dev API needs. */
export interface AdminApiOptions {
  projectDir: string;
  folders: readonly string[];
  title: string;
  /** Per-tool settings the session answers; `{}` when absent. */
  tools?: Record<string, Record<string, unknown>>;
  /** The per-run token; 32 random bytes when absent. */
  token?: string;
  /** The dev server's own bind host, when it names one beyond the loopback names. */
  serverHost?: string;
  /** The body cap; `ADMIN_BODY_LIMIT` when absent. */
  bodyLimit?: number;
}

/** 32 random bytes as the per-run token. */
export const newAdminToken = (): string => randomBytes(32).toString("hex");

const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];

const hostnameOf = (host: string | null): string | null => {
  if (host === null || host === "") return null;
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const hostsAllowed = (host: string | null, serverHost: string | undefined): boolean => {
  const hostname = hostnameOf(host);
  if (hostname === null) return false;
  if (LOOPBACK.includes(hostname)) return true;
  const configured = hostnameOf(serverHost ?? null);
  return configured !== null && hostname === configured;
};

const originOf = (host: string): string[] => [`http://${host}`, `https://${host}`];

const guardHost = (c: Context, options: AdminApiOptions): void => {
  if (!hostsAllowed(c.host, options.serverHost)) throw new HttpError(403, "the admin answers a loopback host only");
};

const guardOrigin = (c: Context): void => {
  const site = c.header("sec-fetch-site");
  if (site !== null && site !== "same-origin") throw new HttpError(403, "the admin session is same-origin only");
  const origin = c.header("origin");
  if (origin === null) return;
  if (!originOf(c.host).includes(origin)) throw new HttpError(403, "the admin session is same-origin only");
};

const safeEqual = (given: string, expected: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
};

const guardToken = (c: Context, token: string): void => {
  const given = c.header(ADMIN_TOKEN_HEADER);
  if (given === null || !safeEqual(given, token)) throw new HttpError(403, "the admin request needs the session token");
};

const inside = (root: string, candidate: string): boolean => candidate === root || candidate.startsWith(root + sep);

const nearestReal = (path: string): string => {
  let current = path;
  const rest: string[] = [];
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    rest.unshift(basename(current));
    current = parent;
  }
  const real = existsSync(current) ? realpathSync(current) : current;
  return rest.length === 0 ? real : join(real, ...rest);
};

/** The project-relative path as an absolute one inside one allowed folder, after the folder and symlink checks. */
export const resolveAdminPath = (projectDir: string, folders: readonly string[], path: string): string => {
  const problem = pathProblem(path);
  if (problem !== null) throw new HttpError(403, `The admin path "${path}" is not allowed: ${problem}`);
  const folder = folders.find((candidate) => withinFolder(path, candidate));
  if (folder === undefined) throw new HttpError(403, `The admin path "${path}" is outside the folders the project allows`);
  const project = resolve(projectDir);
  const folderRoot = resolve(project, folder);
  const candidate = resolve(project, path);
  if (!inside(project, candidate) || !inside(folderRoot, candidate)) throw new HttpError(403, "the admin path leaves its folder");
  const folderReal = nearestReal(folderRoot);
  const candidateReal = nearestReal(candidate);
  if (!inside(folderReal, candidateReal)) throw new HttpError(403, "the admin path leaves its folder through a symlink");
  if (existsSync(candidate)) {
    const real = realpathSync(candidate);
    if (!inside(folderReal, real)) throw new HttpError(403, "the admin path leaves its folder through a symlink");
  }
  return candidate;
};

const TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ts": "text/typescript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

const typeOf = (path: string): string => TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";

const isMissing = (error: unknown): boolean => typeof error === "object" && error !== null && (error as NodeJS.ErrnoException).code === "ENOENT";

const readReply = async (absolute: string): Promise<Reply> => {
  try {
    const body = await readFile(absolute);
    const reply = bytes(new Uint8Array(body), typeOf(absolute));
    reply.headers.set("x-content-type-options", "nosniff");
    reply.headers.set("cache-control", "no-store");
    return reply;
  } catch (error) {
    if (isMissing(error)) return fail("Not found", 404);
    throw error;
  }
};

interface Entry {
  path: string;
  name: string;
  kind: "file" | "dir";
  size: number;
  modified: number;
}

const listReply = async (absolute: string, dir: string): Promise<Reply> => {
  let dirents;
  try {
    dirents = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return json([]);
    throw error;
  }
  const entries: Entry[] = [];
  for (const dirent of dirents) {
    if (dirent.name.startsWith(".")) continue;
    const path = dir === "" ? dirent.name : `${dir}/${dirent.name}`;
    const kind: "file" | "dir" = dirent.isDirectory() ? "dir" : "file";
    let size = 0;
    let modified = 0;
    try {
      const info = await stat(join(absolute, dirent.name));
      size = info.size;
      modified = info.mtimeMs;
    } catch {
      continue;
    }
    entries.push({ path, name: dirent.name, kind, size, modified });
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return json(entries);
};

const writeAtomic = async (absolute: string, body: Uint8Array): Promise<void> => {
  await mkdir(dirname(absolute), { recursive: true });
  const temp = join(dirname(absolute), `.${basename(absolute)}.tmp-${randomBytes(6).toString("hex")}`);
  try {
    await writeFile(temp, body);
    await rename(temp, absolute);
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
};

const deleteFile = async (absolute: string): Promise<void> => {
  try {
    await unlink(absolute);
  } catch (error) {
    if (isMissing(error)) throw new HttpError(404, "no such file");
    throw error;
  }
};

/** The dev file API as an app: `api.handle` mounts it on `light serve`. */
export const createAdminApp = (options: AdminApiOptions): App => {
  const token = options.token ?? newAdminToken();
  const folders = [...options.folders];
  const tools = options.tools ?? {};
  const bodyLimit = options.bodyLimit ?? ADMIN_BODY_LIMIT;
  const app = new App();

  app.get("/__admin/session", (c) => {
    guardHost(c, options);
    guardOrigin(c);
    return json({ token, folders, title: options.title, tools });
  });

  app.get("/__admin/files", async (c) => {
    guardHost(c, options);
    guardToken(c, token);
    const path = c.query("path") ?? "";
    return await readReply(resolveAdminPath(options.projectDir, folders, path));
  });

  app.put("/__admin/files", async (c) => {
    guardHost(c, options);
    guardToken(c, token);
    const path = c.query("path") ?? "";
    const absolute = resolveAdminPath(options.projectDir, folders, path);
    c.limit = bodyLimit;
    const body = await c.bytes();
    await writeAtomic(absolute, body);
    return empty(204);
  });

  app.delete("/__admin/files", async (c) => {
    guardHost(c, options);
    guardToken(c, token);
    const path = c.query("path") ?? "";
    await deleteFile(resolveAdminPath(options.projectDir, folders, path));
    return empty(204);
  });

  app.get("/__admin/list", async (c) => {
    guardHost(c, options);
    guardToken(c, token);
    const path = c.query("path") ?? "";
    return await listReply(resolveAdminPath(options.projectDir, folders, path), path);
  });

  return app;
};

