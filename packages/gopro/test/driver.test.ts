// node-only
/**
 * @file The GoPro driver over a fake camera transport: subscriptions, commands,
 * status, media, preview holds and controls.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";
import type { DeviceControl, DriverSession, MediaItem, Transport } from "@lightstart/devices";
import type { MediaListReply } from "../types.ts";
import driver from "../driver.js";
import {
  CHAR_COMMAND,
  CHAR_COMMAND_RESP,
  CHAR_QUERY,
  CHAR_QUERY_RESP,
  CHAR_SETTING,
  CHAR_SETTING_RESP,
  QUERY_GET_SETTINGS,
  QUERY_GET_CAPABILITIES,
  PUSH_SETTINGS,
} from "../lib/constants.js";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));

const rejects = async (name: string, fn: () => Promise<unknown>, pattern: RegExp) => {
  try {
    await fn();
    ok(name, false);
  } catch (e) {
    ok(name, pattern.test(e instanceof Error ? e.message : String(e)));
  }
};

interface FakeOptions {
  statuses?: Record<number, number>;
  media?: MediaListReply;
  failWrite?: string | null;
  capabilities?: Record<number, number[]>;
  settings?: Record<number, number>;
}

const createFakeCamera = ({
  statuses = {},
  media = { media: [] },
  failWrite = null,
  capabilities = { 2: [1, 9], 3: [5, 8], 121: [0, 4] },
  settings = { 2: 9, 3: 8, 121: 0 },
}: FakeOptions = {}) => {
  const notify = new Map<string, Array<(bytes: number[]) => void>>();
  const writes: Array<{ char: string; payload: number[] }> = [];
  const calls: { join: number; leave: number; fetched: string[]; subscribed: string[]; urls: string[]; preview: unknown[][] } = {
    join: 0,
    leave: 0,
    fetched: [],
    subscribed: [],
    urls: [],
    preview: [],
  };

  const reply = (char: string, requestId: number, body: number[] = [], status = 0) => {
    const payload = [requestId, status, ...body];
    for (const cb of notify.get(char) ?? []) cb([payload.length, ...payload]);
  };

  const statusBody = (ids: number[]) => ids.flatMap((id) => (id in statuses ? [id, 1, statuses[id]] : []));
  const capabilityBody = (ids: number[]) => ids.flatMap((id) => (id in capabilities ? [id, capabilities[id].length, ...capabilities[id]] : []));
  const settingsBody = (ids: number[]) => ids.flatMap((id) => (id in settings ? [id, 1, settings[id]] : []));

  const transport: Transport = {
    available: () => true,
    ble: {
      scan: async () => [],
      stopScan: async () => {},
      connect: async () => {},
      disconnect: async () => {},
      subscribe: async (_id, char) => void calls.subscribed.push(char),
      write: async (_id, char, bytes) => {
        if (failWrite) throw new Error(failWrite);
        const payload = bytes.slice(1);
        writes.push({ char, payload });
        const requestId = payload[0];
        if (char === CHAR_SETTING) {
          settings[requestId] = payload[2];
          reply(CHAR_SETTING_RESP, requestId);
        } else if (char === CHAR_QUERY) {
          const ids = payload.slice(1);
          if (requestId === QUERY_GET_CAPABILITIES) reply(CHAR_QUERY_RESP, requestId, capabilityBody(ids));
          else if (requestId === QUERY_GET_SETTINGS) reply(CHAR_QUERY_RESP, requestId, settingsBody(ids));
          else reply(CHAR_QUERY_RESP, requestId, statusBody(ids));
        } else reply(CHAR_COMMAND_RESP, requestId);
      },
      read: async (_id, char) =>
        [...(char.startsWith("b5f90002") ? "GP-CAM" : "secretpass")].map((c) => c.charCodeAt(0)),
      onNotify: (_id, char, cb) => {
        const set = notify.get(char) ?? [];
        set.push(cb);
        notify.set(char, set);
        return () => notify.set(char, (notify.get(char) ?? []).filter((f) => f !== cb));
      },
      onState: () => () => {},
    },
    wifi: {
      join: async () => (calls.join++, { handle: "net-1" }),
      leave: async () => void calls.leave++,
    },
    preview: {
      start: async (opts) => (calls.preview.push(["start", opts]), { ok: true }),
      stop: async () => void calls.preview.push(["stop"]),
      bounds: async () => {},
      snapshot: async () => ({ url: "/__mobile/native/frame-1.jpg", width: 1280, height: 720 }),
      onState: () => () => {},
    },
    net: {
      getJson: async (url) => (calls.urls.push(url), media),
      fetchToFile: async ({ url, name }) => {
        calls.fetched.push(name);
        return { url: `/__mobile/native/${name}`, bytes: 1024, path: url };
      },
    },
  };
  return { transport, writes, calls, settings, pushNotify: reply };
};

type Session = DriverSession & Required<Pick<DriverSession,
  "status" | "startRecording" | "stopRecording" | "listMedia" | "importMedia"
  | "startPreview" | "stopPreview" | "listControls" | "setControl" | "capturePhoto">>;

const open = async (fake: ReturnType<typeof createFakeCamera>): Promise<Session> =>
  (await driver.connect(fake.transport, { id: "AA:BB" })) as Session;

const clips: MediaItem[] = [
  { name: "A.MP4", dir: "100GOPRO", path: "100GOPRO/A.MP4", sizeBytes: 5, capturedAt: "t1", durationMs: 1000 },
  { name: "B.MP4", dir: "100GOPRO", path: "100GOPRO/B.MP4", sizeBytes: 5, capturedAt: "t2", durationMs: 2000 },
];

const main = async () => {
  {
    const fake = createFakeCamera();
    const session = await open(fake);
    deep("connect subscribes to every response characteristic", fake.calls.subscribed, [CHAR_COMMAND_RESP, CHAR_QUERY_RESP, CHAR_SETTING_RESP]);
    ok("the session carries the shutter capability", session.capabilities.includes("shutter"));
    await session.close();
  }

  {
    const fake = createFakeCamera();
    const session = await open(fake);
    await session.startRecording();
    await session.stopRecording();
    const shutter = fake.writes.filter((w) => w.char === CHAR_COMMAND && w.payload[0] === 0x01);
    deep("startRecording writes the shutter on", shutter[0]?.payload, [0x01, 0x01, 0x01]);
    deep("stopRecording writes the shutter off", shutter[1]?.payload, [0x01, 0x01, 0x00]);
    await session.close();
  }

  {
    const fake = createFakeCamera({ statuses: { 0x46: 88, 0x08: 1 } });
    const session = await open(fake);
    const status = await session.status();
    eq("status decodes the battery", status.battery, 88);
    eq("status decodes the recording flag", status.recording, true);
    await session.close();
  }

  {
    const fake = createFakeCamera();
    const session = await open(fake);
    const seen: boolean[] = [];
    session.on("recording", (d) => seen.push(d.recording));
    await session.startRecording();
    await session.stopRecording();
    deep("recording events fire for listeners", seen, [true, false]);
    await session.close();
  }

  {
    const fake = createFakeCamera({
      media: {
        media: [
          {
            d: "100GOPRO",
            fs: [
              { n: "GX010001.MP4", s: "10", cre: "1770000000", dur: "5" },
              { n: "GX010002.360", s: "10", cre: "1770000600", dur: "5" },
              { n: "GX010003.MP4", s: "10", cre: "1770000600", dur: "5" },
            ],
          },
        ],
      },
    });
    const session = await open(fake);
    const all = await session.listMedia();
    deep("listMedia keeps importable clips", all.map((i) => i.name), ["GX010001.MP4", "GX010003.MP4"]);
    eq("listMedia joins the AP", fake.calls.join, 1);
    const recent = await session.listMedia({ since: new Date(1770000600 * 1000).toISOString() });
    deep("listMedia scopes by time", recent.map((i) => i.name), ["GX010003.MP4"]);
    eq("the AP is joined once and reused", fake.calls.join, 1);
    await session.close();
  }

  {
    const fake = createFakeCamera();
    const session = await open(fake);
    const progress: string[] = [];
    const imported = await session.importMedia(clips, { onProgress: (d, t) => progress.push(`${d}/${t}`) });
    deep("importMedia downloads each clip", fake.calls.fetched, ["A.MP4", "B.MP4"]);
    deep("importMedia reports progress", progress, ["1/2", "2/2"]);
    eq("importMedia answers the served url", imported[0]?.url, "/__mobile/native/A.MP4");
    eq("importMedia keeps the remote path", imported[0]?.remotePath, "100GOPRO/A.MP4");
    eq("importMedia keeps the duration", imported[1]?.durationMs, 2000);
    eq("importMedia releases the AP", fake.calls.leave, 1);
    await session.close();
  }

  {
    const fake = createFakeCamera();
    fake.transport.net.fetchToFile = async () => {
      throw new Error("download-failed");
    };
    const session = await open(fake);
    await rejects("importMedia surfaces a download failure", () => session.importMedia([clips[0]], {}), /download-failed/);
    eq("importMedia releases the AP even when a download throws", fake.calls.leave, 1);
    await session.close();
  }

  eq("matches claims a GoPro name", driver.matches({ id: "1", name: "GoPro 1234" }), true);
  eq("matches claims the control service", driver.matches({ id: "1", services: ["0000fea6-0000-1000-8000-00805f9b34fb"] }), true);
  eq("matches refuses another device", driver.matches({ id: "1", name: "Polar H10" }), false);
  eq("matches refuses an unrelated advertisement", driver.matches({ id: "9" }), false);

  {
    const fake = createFakeCamera();
    fake.transport.ble.write = async (_id, char, bytes) => {
      const payload = bytes.slice(1);
      const requestId = payload[0];
      const target = char === CHAR_QUERY ? CHAR_QUERY_RESP : CHAR_COMMAND_RESP;
      fake.pushNotify(target, requestId, [], 0x01);
    };
    const session = await open(fake);
    await rejects("a command rejects on an error status", () => session.startRecording(), /gopro-status-1/);
    await session.close();
  }

  {
    const fake = createFakeCamera({ media: { media: [{ d: "100GOPRO", fs: [{ n: "GX01.MP4", s: "10", cre: "1", dur: "3" }] }] } });
    const session = await open(fake);
    await session.startPreview();
    eq("preview joins the AP", fake.calls.join, 1);
    ok("preview starts the stream", fake.calls.urls.some((u) => u.endsWith("/stream/start")));
    const items = await session.listMedia();
    await session.importMedia(items, {});
    eq("an import fetched the clip", fake.calls.fetched.length, 1);
    eq("an import must not tear down a live preview", fake.calls.leave, 0);
    await session.stopPreview();
    eq("stopPreview leaves the AP", fake.calls.leave, 1);
    deep("stopPreview stops the transport", fake.calls.preview.at(-1), ["stop"]);
    await session.close();
    eq("closing after a clean stop must not leave twice", fake.calls.leave, 1);
  }

  {
    const fake = createFakeCamera();
    const session = await open(fake);
    await session.capturePhoto();
    const presets = fake.writes.filter((w) => w.payload[0] === 0x3e).map((w) => w.payload);
    deep("capturePhoto switches to photo and back to video", presets, [
      [0x3e, 0x02, 0x03, 0xe9],
      [0x3e, 0x02, 0x03, 0xe8],
    ]);
    await session.close();
  }

  {
    const fake = createFakeCamera();
    const session = await open(fake);
    const controls = await session.listControls();
    const resolution = controls.find((c) => c.id === "resolution");
    ok("listControls reports a resolution", Boolean(resolution));
    deep("listControls reports valid options with our names", resolution?.options, [
      { value: 1, label: "4K" },
      { value: 9, label: "1080p" },
    ]);
    eq("listControls reports the current value", resolution?.value, 9);
    eq("listControls reports the lens", controls.find((c) => c.id === "lens")?.value, 0);
    await session.close();
  }

  {
    const fake = createFakeCamera();
    const session = await open(fake);
    await session.setControl("lens", 4);
    const write = fake.writes.filter((w) => w.char === CHAR_SETTING).at(-1);
    deep("setControl writes the exact setting bytes", write?.payload, [121, 0x01, 0x04]);
    eq("setControl reaches the camera", fake.settings[121], 4);
    await session.close();
  }

  {
    const fake = createFakeCamera();
    const session = await open(fake);
    await rejects("setControl refuses a control the mode lacks", () => session.setControl("nonsense", 1), /unknown-control/);
    await session.close();
  }

  {
    const fake = createFakeCamera();
    const session = await open(fake);
    const seen: unknown[] = [];
    let lastControls: DeviceControl[] = [];
    session.on("status", (data) => seen.push(data));
    session.on("controls", (list) => { lastControls = list; });
    fake.pushNotify(CHAR_QUERY_RESP, PUSH_SETTINGS, [121, 1, 4]);
    eq("a settings push updates the controls", lastControls.find((c) => c.id === "lens")?.value, 4);
    deep("a settings push must not decode as a status", seen, []);
    await session.close();
  }

  {
    const fake = createFakeCamera({ statuses: { 0x46: 71 } });
    const session = await open(fake);
    const seen: unknown[] = [];
    session.on("status", (data) => seen.push(data));
    fake.pushNotify(CHAR_QUERY_RESP, 0x53, [0x46, 1, 71]);
    deep("a status push still decodes", seen, [{ battery: 71 }]);
    await session.close();
  }
};

try {
  await main();
} catch (e) {
  ok(`the driver test completes: ${e instanceof Error ? e.message : String(e)}`, false);
}
done();
