// node-only
/**
 * @file The native backend over a fake mobile shell: the commands it sends and
 * the answers it keeps.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
import { createNativeBackend } from "../native-backend.js";
import { cameraMeter, cameraOrientation } from "../signals.js";

import type { MobileApi } from "@lightstart/mobile/page";

const eqn = (name: string, actual: unknown, expected: unknown) => eq(name, String(actual), String(expected));
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));
const truth = (name: string, value: unknown) => ok(name, Boolean(value));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const fakeMobile = () => {
  const calls: Array<[string, unknown[]]> = [];
  const handlers = new Map<string, (payload: unknown) => void>();
  const api = {
    present: true,
    ready: null,
    can: (name: string) => name === "camera",
    request: async (method: string, args: unknown[] = []) => {
      calls.push([method, args]);
      if (method === "CAMERA:START") return { capabilities: { zoom: { min: 1, max: 10, step: 0.1 }, photoSizes: [{ id: "full", w: 4000, h: 3000, mp: 12 }] }, settings: { zoom: 1, deviceId: "main" } };
      if (method === "CAMERA:SET") {
        const previous = args[0] as Record<string, unknown>;
        return { settings: { [String(previous.key)]: previous.value, deviceId: "main" } };
      }
      if (method === "CAMERA:LENSES") return { lenses: [{ deviceId: "main", label: "Back", lensType: "wide", lensLabel: "Main", nominalMm: 26 }] };
      if (method === "CAMERA:CAPTURE") return {};
      if (method === "CAMERA:RECORD_STOP") return {};
      return {};
    },
    on: (event: string, fn: (payload: unknown) => void) => {
      handlers.set(event, fn);
      return () => handlers.delete(event);
    },
    share: async () => ({ shared: true }),
    shared: () => null,
    reminders: { set: async () => ({ supported: false }), get: async () => ({ supported: false, reminders: [] }), clear: async () => ({ supported: false }) },
    capture: async () => null,
  };
  return { api, calls, handlers };
};

{
  const { api, calls, handlers } = fakeMobile();
  const backend = createNativeBackend({}, api as unknown as MobileApi);
  truth("the native backend says it is supported", backend.isSupported());
  const started = await backend.start({ facingMode: "user", width: 1920, height: 1440 });
  handlers.get("camera:meter")?.({ iso: 400, exposureTime: 0.01 });
  handlers.get("camera:orientation")?.({ rotation: 90 });
  eqn("a start without frames still follows the shell's meter", (cameraMeter.value as { iso?: number }).iso, 400);
  eqn("and its orientation", cameraOrientation.value.rotation, 90);
  eqn("native start answers no stream", started.stream, null);
  deep("the start command goes over the bridge", calls[0]?.[0], "CAMERA:START");
  const startPayload = calls[0]?.[1][0] as Record<string, unknown>;
  eq("the start command carries the facing", startPayload.facingMode, "user");
  eqn("the start command carries the width", startPayload.width, 1920);
  eq("the capabilities are the shell's", String(backend.getCapabilities().zoom?.max), "10");
  eq("the settings are the shell's", backend.getSettings().deviceId, "main");

  const set = await backend.applyControl("zoom", 2);
  eqn("a control answer updates the settings", set.zoom, 2);
  deep("a control is sent as the shell's command", calls.at(-1), ["CAMERA:SET", [{ key: "zoom", value: 2 }]]);

  const view = await backend.applyControl("view", 3);
  deep("the view command magnifies the preview", calls.at(-1), ["CAMERA:VIEW", [{ scale: 3 }]]);
  eqn("the view command leaves the camera settings alone", view.zoom, 2);

  const lenses = await backend.listLenses();
  deep("the shell's lenses come through", lenses.map((lens) => lens.deviceId), ["main"]);

  const photo = await backend.capturePhoto();
  eqn("a capture with no served file answers no blob", photo.blob, null);
  deep("a capture is sent as the shell's command", calls.at(-1), ["CAMERA:CAPTURE", [{ keep: "jpeg" }]]);

  await backend.startRecording({ audio: false });
  deep("a recording start carries the audio flag", calls.at(-1), ["CAMERA:RECORD_START", [{ audio: false }]]);
  eqn("a recording with no served file answers null", await backend.stopRecording(), null);

  backend.setBounds?.({ x: 1, y: 2, width: 3, height: 4 });
  await tick();
  deep("bounds are posted to the shell", calls.at(-1), ["CAMERA:BOUNDS", [{ x: 1, y: 2, width: 3, height: 4 }]]);

  backend.stop();
  await tick();
  deep("stop is posted to the shell", calls.at(-1), ["CAMERA:STOP", [{}]]);
}

done();
