// node-only
/**
 * @file A connected action camera behind the CameraBackend contract.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
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
import { createDeviceBackend } from "../lib/device-backend.js";

import type { DevicesSlot } from "../types.ts";

interface FakeDevices {
  available: boolean;
  device: { id: string };
  previewState: string;
  error: string;
  controls: Array<{ id: string; label: string; options: Array<{ value: number | string; label: string }>; value: number | string | null }>;
  set: Array<[string, number | string]>;
  isReady(): boolean;
  startPreview(): Promise<boolean>;
  stopPreview(): Promise<void>;
  setControl(id: string, value: number | string): Promise<boolean>;
  capturePreviewFrame(): Promise<string>;
  captured: number;
  capturePhoto(): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<void>;
  bounds: { x?: number; y?: number; width?: number; height?: number; fit?: string } | null;
  setPreviewBounds(rect: { x?: number; y?: number; width?: number; height?: number; fit?: string } | null): void;
}

const fakeDevices = (): FakeDevices => {
  const set: Array<[string, number | string]> = [];
  const d: FakeDevices = {
    available: true,
    device: { id: "gp-1" },
    previewState: "off",
    error: "",
    controls: [
      { id: "isoMax", label: "ISO Max", options: [{ value: 0, label: "Auto" }, { value: 1, label: "ISO 100" }, { value: 2, label: "ISO 400" }, { value: 3, label: "ISO 1600" }], value: 2 },
      { id: "shutter", label: "Shutter", options: [{ value: 0, label: "Auto" }, { value: 5, label: "1/120" }, { value: 6, label: "1/240" }], value: 5 },
      { id: "lens", label: "Lens", options: [{ value: 0, label: "Wide" }, { value: 4, label: "Linear" }, { value: 2, label: "Narrow" }], value: 4 },
      { id: "fps", label: "Frame rate", options: [{ value: 8, label: "30" }], value: 8 },
    ],
    set,
    isReady: () => true,
    async startPreview() { d.previewState = "starting"; setTimeout(() => { d.previewState = "live"; }, 0); return true; },
    async stopPreview() { d.previewState = "off"; },
    async setControl(id: string, value: number | string) { set.push([id, value]); const c = d.controls.find((x) => x.id === id); if (c) c.value = value; return true; },
    async capturePreviewFrame() { return "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="; },
    captured: 0,
    async capturePhoto() { d.captured += 1; },
    async startRecording() {},
    async stopRecording() {},
    bounds: null,
    setPreviewBounds(rect) { d.bounds = rect; },
  };
  return d;
};

const backendOf = (d: ReturnType<typeof fakeDevices>, source: { id?: string } = {}, wait?: (ms: number) => Promise<void>) =>
  createDeviceBackend(source, { devices: d as unknown as DevicesSlot, wait });

{
  const d = fakeDevices();
  const backend = backendOf(d, { id: "gp-1" });
  const caps = backend.getCapabilities() as unknown as Record<string, { options: Array<{ value: unknown; label: string }> }>;
  deep("the device's controls are the registry's capabilities", caps.iso.options.map((o) => o.value), ["auto", 100, 400, 1600]);
  eq("one option's label is its number", caps.exposureTime.options[1].value, 1 / 120);
  eq("the lens is a lens, not a capability", "lens" in caps, false);
  const s = backend.getSettings();
  eq("the settings name the device", s.deviceId, "device:gp-1");
  eq("the current ISO is read", s.iso, 400);
  eq("the current shutter is read", s.exposureTime, 1 / 120);
}

{
  const d = fakeDevices();
  const backend = backendOf(d);
  const lenses = await backend.listLenses();
  deep("the lenses are listed by their 35mm length", lenses.map((l) => [l.deviceId, l.nominalMm]), [["lens:0", 16], ["lens:4", 24], ["lens:2", 34]]);
}

{
  const d = fakeDevices();
  const backend = backendOf(d);
  await backend.applyControl("iso", 500);
  await backend.applyControl("iso", "auto");
  await backend.applyControl("exposureTime", 1 / 250);
  await backend.switchLens("lens:2");
  deep("a setting is applied through the nearest option, Auto included", d.set, [["isoMax", 2], ["isoMax", 0], ["shutter", 6], ["lens", 2]]);
  truth("an unsupported control is refused", await rejectsWith(backend.applyControl("colorTemperature", 5500), "control-unsupported"));
}

{
  const d = fakeDevices();
  const backend = backendOf(d, { id: "gp-1" }, () => new Promise((r) => setTimeout(r, 1)));
  const started = await backend.start();
  eq("a device has no stream of its own", started.stream, null);
  eq("the preview is live after start", d.previewState, "live");
  const shot = await backend.capturePhoto();
  truth("a press keeps the preview's frame", shot.blob instanceof Blob);
  eq("the full-size file is asked of the camera", d.captured, 1);
  eq("the capture is pending on the device", shot.pending?.deviceId, "gp-1");
  backend.setBounds?.({ x: 0, y: 0, width: 10, height: 10 });
  deep("the bounds ask for a contained preview", d.bounds, { x: 0, y: 0, width: 10, height: 10, fit: "contain" });
  backend.stop();
  eq("stopping turns the preview off", d.previewState, "off");
}

done();
