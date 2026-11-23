// node-only
/**
 * @file Another phone's camera behind the CameraBackend contract.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
import { createLinkBackend } from "../lib/link-backend.js";

import type { CameraLinkSlot } from "../types.ts";

const eqn = (name: string, actual: unknown, expected: unknown) => eq(name, String(actual), String(expected));
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));
const truth = (name: string, value: unknown) => ok(name, Boolean(value));
const rejectsWith = async (work: Promise<unknown>, text: string) => {
  try {
    await work;
    return false;
  } catch (e) {
    return e instanceof Error && e.message.includes(text);
  }
};

const fakeLink = ({ connected = true } = {}) => {
  const subs: Map<string, (value: unknown) => void> = new Map();
  const calls: unknown[][] = [];
  const link = {
    stream: null as MediaStream | null,
    camera: { phase: "live" as const, count: 0, facing: "environment" as const },
    remoteKind: "web",
    capabilities: { iso: { min: 50, max: 6400, step: 1 } },
    settings: { deviceId: "main", iso: 100 },
    lenses: [{ deviceId: "main", nominalMm: 26 }],
    isConnected: () => connected,
    live: async (on: boolean) => { calls.push(["live", on]); },
    shoot: async (timer: number) => { calls.push(["shoot", timer]); return { blob: new Blob(["jpeg"], { type: "image/jpeg" }), facing: "environment", at: "now" }; },
    flip: async () => { calls.push(["flip"]); },
    applyControl: async (key: string, value: unknown) => { calls.push(["set", key, value]); link.settings = { ...link.settings, [key]: value }; return link.settings; },
    selectLens: async (deviceId: string) => { calls.push(["lens", deviceId]); },
    startRecording: async () => { calls.push(["record"]); },
    stopRecording: async () => { calls.push(["cut"]); return { blob: new Blob(["webm"], { type: "video/webm" }), mime: "video/webm", ext: "webm", durationMs: 2000 }; },
    $state: { subscribe: (key: string, cb: (value: unknown) => void) => { subs.set(key, cb); return () => { subs.delete(key); }; } },
    calls,
    push: (key: string, value: unknown) => subs.get(key)?.(value),
  };
  return link;
};

const backendOf = (link: ReturnType<typeof fakeLink>) =>
  createLinkBackend({ link: () => link as unknown as CameraLinkSlot });

{
  const link = fakeLink();
  const backend = backendOf(link);
  const streams: unknown[] = [];
  backend.on("stream", (value) => streams.push(value));
  const res = await backend.start();
  eqn("a link starts with no stream of its own", res.stream, null);
  deep("a link turns the other camera live", link.calls, [["live", true]]);
  link.push("stream", "a-stream");
  deep("the other phone's stream is forwarded", streams, ["a-stream"]);
  const photo = await backend.capturePhoto();
  eq("a press answers the other phone's photo", photo.blob?.type, "image/jpeg");
  eq("the photo carries the other phone's settings", photo.settings.deviceId, "main");
  deep("the capabilities are the other phone's", Object.keys(backend.getCapabilities()), ["iso"]);
  deep("the lenses are the other phone's", (await backend.listLenses()).map((l) => l.nominalMm), [26]);
  const after = await backend.applyControl("iso", 800);
  eqn("a control set here is set there", after.iso, 800);
  deep("the control reaches the other phone", link.calls.at(-1), ["set", "iso", 800]);
  link.lenses = [{ deviceId: "main", nominalMm: 26 }, { deviceId: "wide", nominalMm: 16 }];
  await backend.switchLens("main");
  truth("the lens in view is not asked for again", !link.calls.some((c) => c[0] === "lens"));
  const switching = backend.start({ deviceId: "wide" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  link.settings = { ...link.settings, deviceId: "wide" };
  link.push("settings", link.settings);
  await switching;
  deep("a different lens is asked of the other phone", link.calls.filter((c) => c[0] === "lens"), [["lens", "wide"]]);
  await backend.startRecording();
  const clip = await backend.stopRecording();
  eq("a clip comes back as a webm", clip?.mime, "video/webm");
  eqn("the clip keeps its duration", clip?.durationMs, 2000);
  deep("the other phone records and cuts", link.calls.slice(-2), [["record"], ["cut"]]);
  backend.stop();
  deep("stopping turns the other camera off", link.calls.at(-1), ["live", false]);
  link.push("stream", "late");
  eqn("nothing arrives after stop", streams.length, 1);
}

{
  const offline = fakeLink({ connected: false });
  const backend = backendOf(offline);
  truth("a link refuses to start before the other phone is linked", await rejectsWith(backend.start(), "link-not-connected"));
  truth("the refusal repeats", await rejectsWith(backend.start(), "link-not-connected"));
  deep("the lenses are the link's, linked or not", (await backend.listLenses()).map((l) => l.deviceId), ["main"]);
}

done();
