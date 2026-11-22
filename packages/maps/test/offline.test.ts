// node-only
/**
 * @file Offline packs: a pack that arrives whole, the failures a shell or a
 * thrown fetch makes, the drained body, progress, and the URLs a pack asks
 * for (with sparse tiles pruned and extra urls riding along).
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { downloadPack, packUrls } from "../offline.js";

const STOPS = [{ lat: -22.95, lng: -43.19 }, { lat: -22.96, lng: -43.18 }];

const withFetch = async <T>(impl: (url: string) => Promise<unknown>, run: () => Promise<T>): Promise<T> => {
  const original = globalThis.fetch;
  globalThis.fetch = impl as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
};

const body = (status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  arrayBuffer: async () => new ArrayBuffer(8),
});

const seen: string[] = [];
const whole = await withFetch(async (url) => {
  seen.push(url);
  return body();
}, () => downloadPack({ urls: ["/a.png", "/b.png", "/c.png"] }));
eq("a pack that arrives whole reports complete", JSON.stringify(whole), JSON.stringify({ total: 3, ok: 3, failed: 0, complete: true }));
eq("every url was fetched", String(seen.length), "3");

const missing = await withFetch(async () => body(404), () => downloadPack({ urls: ["/a.png", "/b.png"] }));
eq("a shell's synthesized 404 counts as a failure", JSON.stringify(missing), JSON.stringify({ total: 2, ok: 0, failed: 2, complete: false }));

let calls = 0;
const thrown = await withFetch(async () => {
  calls += 1;
  if (calls === 1) throw new Error("offline");
  return body();
}, () => downloadPack({ urls: ["/a.png", "/b.png"] }));
eq("a thrown fetch is a failure, not an abort", JSON.stringify([thrown.ok, thrown.failed, thrown.complete]), JSON.stringify([1, 1, false]));
eq("one failure does not stop the rest of the pack", String(calls), "2");

let drained = 0;
await withFetch(async () => ({ ok: true, status: 200, arrayBuffer: async () => { drained += 1; return new ArrayBuffer(8); } }), () => downloadPack({ urls: ["/a.png", "/b.png"] }));
eq("the body is drained, since a cache entry commits only once read", String(drained), "2");

const progress: Array<[number, number]> = [];
await withFetch(async () => body(404), () => downloadPack({ urls: ["/a.png", "/b.png"], onProgress: (done2, total) => progress.push([done2, total]) }));
eq("progress starts at zero", JSON.stringify(progress[0]), JSON.stringify([0, 2]));
eq("progress reports failed attempts too", JSON.stringify(progress.at(-1)), JSON.stringify([2, 2]));

const sparseManifest = { minZoom: 12, fullZoomMax: 12, maxZoom: 13, sparse: {} };
const dense = packUrls({ stops: STOPS, manifest: { minZoom: 12, fullZoomMax: 13, maxZoom: 13 }, tileBase: "/t" });
const sparse = packUrls({ stops: STOPS, manifest: sparseManifest, tileBase: "/t" });
ok("the dense pack asks for tiles", dense.length > 0);
ok("an empty sparse index above fullZoomMax prunes the patches", sparse.length < dense.length);
ok("only the fully baked band survives", sparse.every((url) => url.startsWith("/t/12/")));

const extras = packUrls({ stops: STOPS, manifest: null, tileBase: "/t", extraUrls: () => ["/content/place/x.md"] });
ok("extra urls ride along with the tiles", extras.includes("/content/place/x.md"));

done();
