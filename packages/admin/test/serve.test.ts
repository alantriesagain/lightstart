// node-only
/**
 * @file The guarded dev file API: a loopback host, the session's same-origin
 * rule, the token on every file and listing request, the folder and symlink
 * path guard, atomic writes, listing, deletion, and the body cap. Also
 * `defineAdmin`'s folder rules.
 */

import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { toFetch } from "@lightstart/server/fetch";
import { defineAdmin } from "../index.ts";
import { createAdminApp } from "../node/serve.ts";

const thrown = (fn: () => unknown): string => {
  try {
    fn();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const main = async (): Promise<void> => {
  const project = mkdtempSync(join(tmpdir(), "light-admin-serve-"));
  const outside = mkdtempSync(join(tmpdir(), "light-admin-outside-"));
  writeFileSync(join(outside, "secret.txt"), "outside");
  try {
    mkdirSync(join(project, "social"));
    mkdirSync(join(project, "social", "posts"));
    writeFileSync(join(project, "social", "posts", "day.md"), "# Day\n");
    const token = "token-for-the-test-0123456789abcdef";
    const handle = toFetch(createAdminApp({ projectDir: project, folders: ["social"], title: "Site Admin", token }));
    const send = (path: string, init: RequestInit = {}): Promise<Response> => handle(new Request(new URL(path, "http://localhost:4321"), init));
    const fileHeaders = { [ADMIN_TOKEN]: token };
    const origin = { origin: "http://localhost:4321" };

    const session = await send("/__admin/session", { headers: origin });
    eqn("the session answers 200 same-origin", session.status, 200);
    eq("it carries the token, folders and title", await session.text(), JSON.stringify({ token, folders: ["social"], title: "Site Admin" }));
    eq("it never grants CORS", session.headers.get("access-control-allow-origin") ?? "", "");

    eqn("a non-loopback host is refused", (await send("http://evil.example/__admin/session", { headers: origin })).status, 403);
    eqn("a cross-origin session is refused", (await send("/__admin/session", { headers: { origin: "http://evil.example" } })).status, 403);
    eqn("a cross-site fetch metadata is refused", (await send("/__admin/session", { headers: { "sec-fetch-site": "cross-site" } })).status, 403);
    eqn("a same-origin fetch metadata is allowed", (await send("/__admin/session", { headers: { "sec-fetch-site": "same-origin", ...origin } })).status, 200);

    eqn("a file request without the token is refused", (await send("/__admin/files?path=social/posts/day.md")).status, 403);
    eqn("a file request with a wrong token is refused", (await send("/__admin/files?path=social/posts/day.md", { headers: { [ADMIN_TOKEN]: "wrong" } })).status, 403);
    eqn("a file request with the token is answered", (await send("/__admin/files?path=social/posts/day.md", { headers: fileHeaders })).status, 200);
    const read = await send("/__admin/files?path=social/posts/day.md", { headers: fileHeaders });
    eq("the file content is the stored bytes", await read.text(), "# Day\n");
    ok("its content type is guessed", (read.headers.get("content-type") ?? "").startsWith("text/markdown"));
    eq("a file is answered nosniff", read.headers.get("x-content-type-options") ?? "", "nosniff");
    eqn("a missing file is 404", (await send("/__admin/files?path=social/posts/none.md", { headers: fileHeaders })).status, 404);

    const put = await send("/__admin/files?path=social/posts/new/one.txt", { method: "PUT", headers: fileHeaders, body: "hello" });
    eqn("a write answers 204", put.status, 204);
    eq("the parent folder was made and the content written", await (await send("/__admin/files?path=social/posts/new/one.txt", { headers: fileHeaders })).text(), "hello");
    ok("no temporary file is left behind", readdirSync(join(project, "social", "posts", "new")).every((name) => !name.startsWith(".")));

    writeFileSync(join(project, "social", "posts", ".day.md.tmp-x"), "partial");
    const listed = await send("/__admin/list?path=social/posts", { headers: fileHeaders });
    eqn("a listing answers 200", listed.status, 200);
    const entries = (await listed.json()) as Array<{ name: string; kind: string; path: string }>;
    eq("the listing is sorted by name, dot-entries left out", entries.map((entry) => entry.name).join(","), "day.md,new");
    ok("an entry names its kind and project path", entries.some((entry) => entry.path === "social/posts/day.md" && entry.kind === "file"));
    eq("a missing directory lists nothing", await (await send("/__admin/list?path=social/missing", { headers: fileHeaders })).text(), "[]");

    const del = await send("/__admin/files?path=social/posts/new/one.txt", { method: "DELETE", headers: fileHeaders });
    eqn("a delete answers 204", del.status, 204);
    eqn("the deleted file is gone", (await send("/__admin/files?path=social/posts/new/one.txt", { headers: fileHeaders })).status, 404);
    eqn("deleting a missing file is 404", (await send("/__admin/files?path=social/posts/none.txt", { method: "DELETE", headers: fileHeaders })).status, 404);

    eqn("a .. escape is refused", (await send("/__admin/files?path=../outside.txt", { headers: fileHeaders })).status, 403);
    eqn("an absolute path is refused", (await send("/__admin/files?path=/etc/passwd", { headers: fileHeaders })).status, 403);
    eqn("a path outside every folder is refused", (await send("/__admin/files?path=other/file.txt", { headers: fileHeaders })).status, 403);
    eqn("a write into .git is refused", (await send("/__admin/files?path=social/.git/config", { method: "PUT", headers: fileHeaders, body: "x" })).status, 403);

    symlinkSync(outside, join(project, "social", "link"), "dir");
    eqn("a symlink out of the folder is refused for a read", (await send("/__admin/files?path=social/link/secret.txt", { headers: fileHeaders })).status, 403);
    eqn("a symlink out of the folder is refused for a write", (await send("/__admin/files?path=social/link/secret.txt", { method: "PUT", headers: fileHeaders, body: "x" })).status, 403);

    const small = toFetch(createAdminApp({ projectDir: project, folders: ["social"], title: "Admin", token, bodyLimit: 8 }));
    const tooLarge = await small(new Request(new URL("/__admin/files?path=social/big.txt", "http://localhost:4321"), { method: "PUT", headers: { [ADMIN_TOKEN]: token }, body: "123456789" }));
    eqn("a body over the cap is 413", tooLarge.status, 413);

    ok("defineAdmin accepts a clean folder", defineAdmin({ folders: ["social", "social/posts"] }).folders.join(",") === "social,social/posts");
    eq("defineAdmin accepts an empty list", defineAdmin({ folders: [] }).folders.join(","), "");
    ok("defineAdmin refuses ..", thrown(() => defineAdmin({ folders: ["../x"] })).includes("../x"));
    ok("defineAdmin refuses an absolute path", thrown(() => defineAdmin({ folders: ["/x"] })).includes("/x"));
    ok("defineAdmin refuses a backslash", thrown(() => defineAdmin({ folders: ["a\\b"] })).includes("a\\b"));
    ok("defineAdmin refuses .git", thrown(() => defineAdmin({ folders: [".git"] })).includes(".git"));
    ok("defineAdmin refuses node_modules", thrown(() => defineAdmin({ folders: ["node_modules"] })).includes("node_modules"));
    ok("defineAdmin refuses a dotfile", thrown(() => defineAdmin({ folders: [".drafts"] })).includes(".drafts"));
    ok("defineAdmin refuses a control character", thrown(() => defineAdmin({ folders: ["a\u0001b"] })).includes("control"));
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
  done();
};

const ADMIN_TOKEN = "x-light-admin-token";

await main();
