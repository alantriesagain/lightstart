// node-only
/**
 * @file The web backend over a fake `navigator.mediaDevices`: the constraints
 * it asks for, the track's capabilities and settings, and the lenses.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
import { createWebBackend, isSupported } from "../web-backend.js";

const eqn = (name: string, actual: unknown, expected: unknown) => eq(name, String(actual), String(expected));
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));
const truth = (name: string, value: unknown) => ok(name, Boolean(value));

const asked: unknown[][] = [];
const applied: unknown[] = [];
let stopped = 0;

const track = {
  getCapabilities: () => ({ zoom: { min: 1, max: 4, step: 0.1 }, torch: true }),
  getSettings: () => ({ width: 640, height: 480, aspectRatio: 1.333, deviceId: "cam1" }),
  applyConstraints: async (constraints: unknown) => { applied.push(constraints); },
  stop: () => { stopped += 1; },
};
const stream = {
  getVideoTracks: () => [track],
  getTracks: () => [track],
};

const devices = [
  { kind: "videoinput", deviceId: "cam1", label: "Back Ultra Wide Camera" },
  { kind: "videoinput", deviceId: "cam2", label: "Front Camera" },
  { kind: "audioinput", deviceId: "mic", label: "Microphone" },
];

const mediaDevices = {
  getUserMedia: async (constraints: unknown) => { asked.push([constraints]); return stream; },
  enumerateDevices: async () => devices,
};

const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
Object.defineProperty(globalThis, "navigator", { value: { mediaDevices }, configurable: true });

try {
  truth("the web backend is supported with getUserMedia", isSupported());
  const backend = createWebBackend();
  eq("the backend names itself web", backend.kind, "web");

  const started = await backend.start({ facingMode: "user", width: 1280, height: 720, frameRate: 30 });
  truth("start answers a stream", started.stream !== null);
  truth("start answers a track", started.track !== null);
  truth("the backend answers a stream", backend.getStream() !== null);
  const first = asked[0]?.[0] as Record<string, unknown>;
  const video = first.video as Record<string, unknown>;
  eq("the default facing is passed", video.facingMode, "user");
  deep("the width is asked as a preference", video.width, { ideal: 1280 });
  truth("the width and height are ideal constraints", JSON.stringify(video.height) === JSON.stringify({ ideal: 720 }));

  eqn("capabilities come from the track", backend.getCapabilities().zoom?.max, 4);
  const settings = backend.getSettings();
  eqn("settings keep the width", settings.width, 640);
  truth("settings drop the aspect ratio", !("aspectRatio" in settings));

  await backend.applyControl("zoom", 2);
  deep("a control is an advanced constraint", applied[0], { advanced: [{ zoom: 2 }] });

  const lenses = await backend.listLenses();
  deep("the lenses are the video inputs", lenses.map((lens) => lens.deviceId), ["cam1", "cam2"]);
  eq("a lens is classified from its label", lenses[0]?.lensType, "ultrawide");
  eq("the front lens is classified", lenses[1]?.lensType, "front");

  await backend.switchLens("cam2");
  const second = asked[1]?.[0] as Record<string, unknown>;
  const secondVideo = second.video as Record<string, unknown>;
  deep("a switch asks for the exact device", secondVideo.deviceId, { exact: "cam2" });

  backend.stop();
  truth("stop stops the track", stopped >= 1);
  eqn("stop releases the stream", backend.getStream(), null);
} finally {
  if (original) Object.defineProperty(globalThis, "navigator", original);
  else Reflect.deleteProperty(globalThis, "navigator");
}

done();
