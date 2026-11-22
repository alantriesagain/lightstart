// node-only
/**
 * @file The strategy: loopback detection, and `configureP2P` naming the
 * signalers and relay, with a live `/_relay/info` read through the app's
 * base and a project's declared list winning over the default.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { setAppBase } from "@lightstart/app/base.ts";
import { configureP2P, isLoopback, resolveSignalers } from "../strategy.js";

for (const host of ["localhost", "127.0.0.1", "[::1]"]) ok(`isLoopback answers true for ${host}`, isLoopback(host));
for (const host of ["studio.localhost", "gamestudio.localhost"]) ok(`isLoopback answers true for ${host}`, isLoopback(host));
for (const host of ["192.168.1.20", "10.0.0.7", "app.lightstart.dev"]) ok(`isLoopback answers false for ${host}`, !isLoopback(host));
for (const host of ["localhost.evil.com", "notlocalhost", "mylocalhost.io"]) ok(`isLoopback matches the suffix, not the substring: ${host}`, !isLoopback(host));

const withConfig = async (settings: Parameters<typeof configureP2P>[0], info: unknown = null) => {
  const prevFetch = globalThis.fetch;
  const prevLocation = globalThis.location;
  /** @type {string[]} */
  const requested: string[] = [];
  globalThis.fetch = async (input: string | URL | Request) => {
    requested.push(String(input));
    return { ok: info !== null, json: async () => info } as Response;
  };
  globalThis.location = { origin: "http://localhost:3500", hostname: "localhost", search: "" } as unknown as Location;
  configureP2P(settings);
  try {
    return { result: await resolveSignalers(), requested };
  } finally {
    globalThis.fetch = prevFetch;
    globalThis.location = prevLocation;
  }
};

{
  const { result } = await withConfig({ relayUrl: null });
  eq("declaring nothing reaches for nothing", JSON.stringify(result.signalers), "[]");
}

{
  const { result } = await withConfig({ relayUrl: "ws://localhost:3500/_relay" });
  eq("a declared relay is used alone", JSON.stringify(result.signalers), JSON.stringify(["relay"]));
}

{
  const { result } = await withConfig({ relayUrl: "ws://localhost:3500/_relay", signalers: ["relay", "torrent"] });
  eq("the project's declared list wins over the default", JSON.stringify(result.signalers), JSON.stringify(["relay", "torrent"]));
}

{
  const { result } = await withConfig({ relayUrl: null }, { relay: true, origins: { local: "http://localhost:3500", lan: "http://192.168.0.2:3500" } });
  eq("a live relay is found by probe", JSON.stringify(result.signalers), JSON.stringify(["relay"]));
  eq("its reachable origin is the relay URL", String(result.relayUrl), "http://192.168.0.2:3500");
}

{
  const { requested } = await withConfig({ relayUrl: null });
  eq("the relay probe is a root-relative path at the root", requested[0] ?? "", "/_relay/info");
}

{
  setAppBase("/budget");
  try {
    const { requested } = await withConfig({ relayUrl: null });
    eq("the relay probe carries the app's base", requested[0] ?? "", "/budget/_relay/info");
  } finally {
    setAppBase("");
  }
}

done();
