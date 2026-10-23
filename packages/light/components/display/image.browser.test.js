import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createBase64Style } from "./image.js";

const PIXEL = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
), (c) => c.charCodeAt(0));

const realFetch = globalThis.fetch;

/** @type {string[]} */
let asked = [];

/**
 * Intercept only the probe urls. The harness posts console output through
 * fetch, and a console.error inside the code under test would otherwise be
 * counted as one of its own requests.
 *
 * @param {(url: string) => Response | Promise<Response>} handler
 */
const stubFetch = (handler) => {
  asked = [];
  globalThis.fetch = /** @type {typeof fetch} */ (async (input, init) => {
    const url = String(input);
    if (!url.startsWith("/probe-")) return realFetch(input, init);
    asked.push(url);
    return handler(url);
  });
};

const ok = () => new Response(PIXEL, { status: 200, headers: { "content-type": "image/png" } });
const fail = () => new Response("nope", { status: 500 });

let seq = 0;
const freshUrl = () => `/probe-${++seq}.png`;

describe("@bootstrapp/light - lc-image style cache", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("fetches a url once and reuses the result", async () => {
    stubFetch(ok);
    const url = freshUrl();

    await createBase64Style(url, "a1");
    await createBase64Style(url, "a2");

    assert.deepEqual(asked, [url], "the second caller waited on the first fetch");
  });

  it("tries again after a failure instead of caching it forever", async () => {
    let attempts = 0;
    stubFetch(() => (++attempts === 1 ? fail() : ok()));
    const url = freshUrl();

    await createBase64Style(url, "b1");
    assert.equal(attempts, 1, "the first attempt failed");

    await createBase64Style(url, "b2");
    assert.equal(attempts, 2, "so the next caller asked again rather than inheriting the failure");
  });

  it("caches once it finally succeeds", async () => {
    let attempts = 0;
    stubFetch(() => (++attempts === 1 ? fail() : ok()));
    const url = freshUrl();

    await createBase64Style(url, "c1");
    await createBase64Style(url, "c2");
    await createBase64Style(url, "c3");

    assert.equal(attempts, 2, "one failure, one success, then the cache answers");
  });

  it("never rejects, so one broken image cannot take a render down", async () => {
    stubFetch(fail);
    await createBase64Style(freshUrl(), "d1");
  });
});
