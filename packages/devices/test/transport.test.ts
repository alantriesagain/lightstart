// node-only
/**
 * @file The native transport over a fake mobile shell: the commands it sends,
 * the answers it keeps, and the events it hears.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";
import { createNativeTransport } from "../controllers/devices/transport-native.js";
import { BLE_NOTIFY, BLE_SCAN_START, BLE_STATE, BLE_WRITE, DOWNLOAD_FETCH, STREAM_STATE, WIFI_JOIN } from "../commands.js";
import { DOWNLOAD_PROGRESS } from "../events.js";
import type { MobileApi } from "@lightstart/mobile/page";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));

const fakeMobile = () => {
  const calls: Array<[string, unknown]> = [];
  const listeners = new Map<string, Array<(payload: unknown) => void>>();
  /** @param {string} event @param {unknown} payload */
  const push = (event: string, payload: unknown) => {
    for (const fn of listeners.get(event) ?? []) fn(payload);
  };
  const api = {
    present: true,
    ready: null,
    can: () => true,
    /** @param {string} method @param {unknown[]} args */
    request: async (method: string, args: unknown[] = []) => {
      calls.push([method, args[0]]);
      if (method === BLE_SCAN_START) return [{ id: "AA", name: "GoPro", rssi: -40, services: [] }];
      if (method === BLE_WRITE) return null;
      if (method === "BLE:READ") return { data: "030101" };
      if (method === WIFI_JOIN) return { handle: "net-1" };
      if (method === "STREAM:START") return { ok: true, port: 8554 };
      if (method === "STREAM:SNAPSHOT") return { url: "/__mobile/native/frame.jpg", width: 4, height: 3 };
      if (method === "DOWNLOAD:GET") return { media: [] };
      if (method === DOWNLOAD_FETCH) {
        push(DOWNLOAD_PROGRESS, { name: "A.MP4", bytes: 5, total: 10 });
        return { url: "/__mobile/native/A.MP4", bytes: 10, path: "/tmp/A.MP4" };
      }
      return null;
    },
    /** @param {string} event @param {(payload: unknown) => void} fn */
    on: (event: string, fn: (payload: unknown) => void) => {
      const list = listeners.get(event) ?? [];
      list.push(fn);
      listeners.set(event, list);
      return () => listeners.set(event, (listeners.get(event) ?? []).filter((f) => f !== fn));
    },
  };
  return { api, calls, push };
};

const main = async () => {
  {
    const { api, calls } = fakeMobile();
    const transport = createNativeTransport(api as unknown as MobileApi);
    ok("the native transport is available inside a shell", transport.available());

    const found = await transport.ble.scan({ services: ["svc"], timeoutMs: 100 });
    deep("scan sends the family's start message", calls[0], [BLE_SCAN_START, { services: ["svc"], timeoutMs: 100 }]);
    deep("scan answers the shell's rows", found.map((row) => row.id), ["AA"]);

    await transport.ble.write("AA", "char", [0x03, 0x01, 0x01], false);
    deep("a write crosses as hex with its response flag", calls.at(-1), [BLE_WRITE, { id: "AA", char: "char", data: "030101", withResponse: false }]);

    deep("a read decodes the shell's hex", await transport.ble.read("AA", "char"), [0x03, 0x01, 0x01]);

    await transport.wifi.join({ ssid: "GP", password: "pw" });
    deep("a wifi join carries its credentials", calls.at(-1), [WIFI_JOIN, { ssid: "GP", password: "pw", timeoutMs: 45000 }]);

    await transport.preview.start({ handle: "net-1" });
    deep("a preview start carries its handle", calls.at(-1), ["STREAM:START", { port: 8554, handle: "net-1", fit: "contain" }]);
    deep("a snapshot answers the served frame", await transport.preview.snapshot(), { url: "/__mobile/native/frame.jpg", width: 4, height: 3 });
  }

  {
    const { api, push } = fakeMobile();
    const transport = createNativeTransport(api as unknown as MobileApi);

    const notified: number[][] = [];
    const off = transport.ble.onNotify("AA", "B5F9", (bytes) => notified.push(bytes));
    push(BLE_NOTIFY, { id: "AA", char: "b5f9", data: "0aff" });
    push(BLE_NOTIFY, { id: "BB", char: "b5f9", data: "00" });
    push(BLE_NOTIFY, { id: "AA", char: "other", data: "00" });
    deep("a notify reaches its listener decoded, filtered by id and folded char", notified, [[0x0a, 0xff]]);
    off();
    push(BLE_NOTIFY, { id: "AA", char: "b5f9", data: "11" });
    eq("an unsubscribed listener hears nothing more", notified.length, 1);

    const states: Array<{ connected: boolean }> = [];
    transport.ble.onState("AA", (state) => states.push(state));
    push(BLE_STATE, { id: "AA", connected: true });
    push(BLE_STATE, { id: "BB", connected: false });
    deep("a state push reaches its device", states, [{ connected: true, reason: undefined }]);

    const previews: string[] = [];
    transport.preview.onState((data) => previews.push(data.state));
    push(STREAM_STATE, { state: "live", code: "bind" });
    deep("a stream state reaches the preview", previews, ["live"]);

    const progress: Array<{ bytes: number, total: number }> = [];
    const result = await transport.net.fetchToFile({
      url: "http://10.5.5.9/A.MP4",
      name: "A.MP4",
      handle: "net-1",
      onProgress: (p) => progress.push(p),
    });
    eq("a download answers its served url", result.url, "/__mobile/native/A.MP4");
    deep("a download reports progress", progress.map((p) => `${p.bytes}/${p.total}`), ["5/10"]);
  }

  {
    const off = createNativeTransport({ present: false } as unknown as MobileApi);
    eq("the native transport is unavailable outside a shell", off.available(), false);
  }
};

try {
  await main();
} catch (e) {
  ok(`the transport test completes: ${e instanceof Error ? e.message : String(e)}`, false);
}
done();
