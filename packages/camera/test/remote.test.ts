// node-only
/**
 * @file One phone as another's camera over a peer room: the clip, the
 * settings, the track, the shutter, the timer, the flip, the off/on cycle and
 * the failures.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
import { serveCamera, viewCamera } from "../remote.js";

import type { CameraInstance, RemoteRoom, RemoteViewer } from "../types.ts";

type ActionHandler = (data: unknown, from: string) => void;

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const until = async (predicate: () => boolean, label = "condition", timeout = 4000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await tick(5);
  }
  throw new Error(`timed out waiting for ${label}`);
};

const eqn = (name: string, actual: unknown, expected: unknown) => eq(name, String(actual), String(expected));
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));
const truth = (name: string, value: unknown) => ok(name, Boolean(value));

const oneEmitter = <T>() => {
  const handlers = new Set<(value: T) => void>();
  return {
    on: (handler: (value: T) => void) => { handlers.add(handler); return () => { handlers.delete(handler); }; },
    emit: (value: T) => { for (const handler of [...handlers]) handler(value); },
  };
};

const twoEmitter = <A, B>() => {
  const handlers = new Set<(a: A, b: B) => void>();
  return {
    on: (handler: (a: A, b: B) => void) => { handlers.add(handler); return () => { handlers.delete(handler); }; },
    emit: (a: A, b: B) => { for (const handler of [...handlers]) handler(a, b); },
  };
};

type RoomPeer = { _hear(name: string, data: unknown, from: string): void; _track(from: string, track: MediaStreamTrack): void };
type TestRoom = RemoteRoom & { selfId: string; other: RoomPeer | null; sent: Array<[string, unknown, string | undefined]>; local: MediaStreamTrack | null; action(name: string): { send(data: unknown, to?: string | string[]): Promise<void>; on(handler: ActionHandler): () => void }; _hear(name: string, data: unknown, from: string): void; _track(from: string, track: MediaStreamTrack): void; _leave(id: string): void };

const roomPair = () => {
  const make = (selfId: string): TestRoom => {
    const actions: Map<string, ReturnType<typeof twoEmitter<unknown, string>>> = new Map();
    const track = twoEmitter<string, MediaStreamTrack>();
    const join = oneEmitter<string>();
    const leave = oneEmitter<string>();
    let room: TestRoom;
    room = {
      selfId,
      other: null,
      sent: [],
      local: null,
      action: (name: string) => {
        if (!actions.has(name)) actions.set(name, twoEmitter<unknown, string>());
        const emitterOf = actions.get(name) as ReturnType<typeof twoEmitter<unknown, string>>;
        return {
          send: async (data: unknown, to?: string | string[]) => {
            room.sent.push([name, data, typeof to === "string" ? to : undefined]);
            setTimeout(() => room.other?._hear(name, structuredClone(data), selfId), 0);
          },
          on: emitterOf.on,
        };
      },
      _hear: (name: string, data: unknown, from: string) => actions.get(name)?.emit(data, from),
      setTrack: async (next: MediaStreamTrack | null) => {
        room.local = next;
        if (next) setTimeout(() => room.other?._track(selfId, next), 0);
      },
      _track: (from: string, next: MediaStreamTrack) => track.emit(from, next),
      onTrack: track.on,
      onPeerJoin: join.on,
      onPeerLeave: leave.on,
      _leave: (id: string) => leave.emit(id),
    };
    return room;
  };
  const camera = make("camera-phone");
  const viewer = make("viewer-phone");
  camera.other = viewer;
  viewer.other = camera;
  return { camera, viewer };
};

const fakeCamera = ({ deny = false, startDelay = 0 } = {}) => {
  const calls: Array<Array<unknown>> = [];
  const sizes: string[] = [];
  let settings: Record<string, unknown> = { deviceId: "main", iso: 100, exposureTime: 200 };
  const camera = {
    calls,
    sizes,
    start: async ({ facingMode, deviceId, width, height }: { facingMode?: string, deviceId?: string, width?: number, height?: number }) => {
      calls.push(["start", deviceId || facingMode]);
      sizes.push(`${width}x${height}`);
      if (deny) throw new Error("NotAllowedError");
      if (deviceId) settings = { ...settings, deviceId };
      return { stream: null, track: { kind: "video", id: `track-${deviceId || facingMode}` }, lenses: [{ deviceId: "main", nominalMm: 26 }, { deviceId: "tele", nominalMm: 52 }], activeLens: null };
    },
    stop: () => calls.push(["stop"]),
    getCapabilities: () => ({ iso: { min: 50, max: 6400, step: 1 }, exposureTime: { min: 1, max: 10000, step: 1 } }),
    getSettings: () => settings,
    applyControl: async (key: string, value: unknown) => { calls.push(["set", key, value]); settings = { ...settings, [key]: value }; return settings; },
    capturePhoto: async () => ({ blob: new Blob([new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9])], { type: "image/jpeg" }), exif: null, settings: {} }),
    startRecording: async () => { calls.push(["record"]); if (startDelay) await tick(startDelay); },
    stopRecording: async () => { calls.push(["cut"]); return { blob: new Blob([new Uint8Array(1_600_000).fill(7)], { type: "video/webm" }), durationMs: 3200, mime: "video/webm", ext: "webm" }; },
  };
  return camera;
};

const served = (room: RemoteRoom, camera: ReturnType<typeof fakeCamera>) =>
  serveCamera({ room, camera: camera as unknown as CameraInstance });

const viewerOf = (room: RemoteRoom): RemoteViewer => viewCamera({ room });

{
  const rooms = roomPair();
  const camera = fakeCamera();
  const serving = served(rooms.camera, camera);
  const viewer = viewerOf(rooms.viewer);
  const clips: Array<{ mime: string; durationMs: number; blob: Blob } | null> = [];
  viewer.onClip((clip) => clips.push(clip));
  await serving.start();
  await until(() => viewer.state.phase === "live", "live");
  await viewer.record(true);
  await until(() => viewer.state.phase === "recording", "recording");
  await viewer.record(false);
  await until(() => clips.length === 1, "the clip", 8000);
  const clip = clips[0];
  eq("a record request comes back as a webm clip", String(clip?.mime), "video/webm");
  eqn("the clip keeps its duration", clip?.durationMs, 3200);
  eqn("the clip keeps its bytes", clip?.blob.size, 1_600_000);
  truth("the clip travels in parts", rooms.camera.sent.filter(([name]) => name === "cam:clip").length >= 3);
  await until(() => viewer.state.phase === "live", "live again");
  deep("the camera records and cuts once", camera.calls.filter((c) => c[0] === "record" || c[0] === "cut"), [["record"], ["cut"]]);
  serving.close();
  viewer.close();
}

{
  const rooms = roomPair();
  const camera = fakeCamera();
  const serving = served(rooms.camera, camera);
  const viewer = viewerOf(rooms.viewer);
  const seen: Array<Record<string, unknown>> = [];
  viewer.onSettings((value) => seen.push(value));
  await serving.start();
  await until(() => viewer.caps.deviceId === "main", "caps");
  deep("the viewer hears the camera's capabilities", Object.keys(viewer.caps.capabilities), ["iso", "exposureTime", "photoSizes"]);
  deep("the viewer hears the camera's lenses", viewer.caps.lenses.map((l) => l.nominalMm), [26, 52]);
  eqn("the viewer hears the camera's current settings", viewer.caps.settings.iso, 100);
  await viewer.set("iso", 800);
  await until(() => viewer.caps.settings.iso === 800, "iso set on the camera phone");
  deep("the setting reaches the camera phone", camera.calls.at(-1), ["set", "iso", 800]);
  await viewer.selectLens("tele");
  await until(() => viewer.caps.deviceId === "tele", "the tele lens");
  deep("switching lens restarts the camera on it", camera.calls.filter((c) => c[0] === "start"), [["start", "environment"], ["start", "tele"]]);
  truth("the viewer hears settings more than once", seen.length >= 2);
  eq("photos come back at 1600 on the long side unless asked", String(viewer.caps.settings.photoSize), "1200x1600");
  const photoSizes = viewer.caps.capabilities.photoSizes as Array<{ label: string }>;
  deep("the photo sizes are labelled", photoSizes.map((p) => p.label), ["2MP", "8MP", "Full"]);
  await viewer.set("photoSize", "0x0");
  await until(() => viewer.caps.settings.photoSize === "0x0", "full size");
  truth("the size is the serving side's, not the camera's", !camera.calls.some((c) => c[0] === "set" && c[1] === "photoSize"));
  serving.close();
  viewer.close();
}

{
  const rooms = roomPair();
  const camera = fakeCamera();
  const serving = served(rooms.camera, camera);
  const viewer = viewerOf(rooms.viewer);
  const tracks: Array<string | undefined> = [];
  viewer.onTrack((track) => tracks.push(track?.id));
  await serving.start();
  await until(() => viewer.state.phase === "live" && tracks.length === 1, "live with a track");
  deep("the camera starts once", camera.calls, [["start", "environment"]]);
  eq("the viewer holds the camera's track", viewer.track?.id, "track-environment");
  truth("the viewer is connected", viewer.connected);
  serving.close();
  viewer.close();
}

{
  const rooms = roomPair();
  const serving = served(rooms.camera, fakeCamera());
  const viewer = viewerOf(rooms.viewer);
  const photos: Array<{ blob: Blob; facing: string } | null> = [];
  viewer.onPhoto((photo) => photos.push(photo));
  await serving.start();
  await until(() => viewer.state.phase === "live", "live");
  await viewer.shoot(0);
  await until(() => photos.length === 1, "photo");
  const photo = photos[0];
  eq("the photo comes back as a jpeg", photo?.blob.type, "image/jpeg");
  deep("the photo comes back whole", [...new Uint8Array(await photo?.blob.arrayBuffer() ?? new ArrayBuffer(0))], [0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  eq("the photo says which way it faced", photo?.facing, "environment");
  await until(() => viewer.state.phase === "live", "live again");
  serving.close();
  viewer.close();
}

{
  const rooms = roomPair();
  const serving = served(rooms.camera, fakeCamera());
  const viewer = viewerOf(rooms.viewer);
  const counts: string[] = [];
  viewer.onState((state) => counts.push(`${state.phase}:${state.count}`));
  await serving.start();
  await until(() => viewer.state.phase === "live", "live");
  await viewer.shoot(3);
  await until(() => viewer.state.phase === "counting" && viewer.state.count === 2, "counting", 3000);
  await viewer.cancel();
  await until(() => viewer.state.phase === "live", "cancelled");
  truth("the countdown starts at three", counts.includes("counting:3"));
  eqn("the cancel resets the count", serving.state.count, 0);
  serving.close();
  viewer.close();
}

{
  const rooms = roomPair();
  const camera = fakeCamera();
  const serving = served(rooms.camera, camera);
  const viewer = viewerOf(rooms.viewer);
  await serving.start();
  await until(() => viewer.state.phase === "live", "live");
  await viewer.flip();
  await until(() => viewer.state.facing === "user" && viewer.track?.id === "track-user", "front camera");
  deep("the flip starts the front camera", camera.calls.map((c) => c.join(":")), ["start:environment", "start:user"]);
  serving.close();
  viewer.close();
}

{
  const rooms = roomPair();
  const camera = fakeCamera();
  const serving = served(rooms.camera, camera);
  const viewer = viewerOf(rooms.viewer);
  await serving.start();
  await until(() => viewer.state.phase === "live", "live");
  await viewer.live(false);
  await until(() => viewer.state.phase === "off", "off");
  eqn("turning live off puts the track away", rooms.camera.local, null);
  await viewer.live(true);
  await until(() => viewer.state.phase === "live", "live again");
  deep("the camera stops and starts again", camera.calls.map((c) => c[0]), ["start", "stop", "start"]);
  serving.close();
  viewer.close();
}

{
  const rooms = roomPair();
  const serving = served(rooms.camera, fakeCamera({ deny: true }));
  const viewer = viewerOf(rooms.viewer);
  await serving.start();
  await until(() => viewer.state.phase === "denied", "denied");
  rooms.viewer._leave("camera-phone");
  eq("a camera that leaves reads as gone", viewer.state.phase, "gone");
  eqn("a camera that leaves disconnects", viewer.connected, false);
  serving.close();
  viewer.close();
}

{
  const rooms = roomPair();
  const camera = fakeCamera({ startDelay: 300 });
  const serving = served(rooms.camera, camera);
  const viewer = viewerOf(rooms.viewer);
  const clips: Array<{ durationMs: number } | null> = [];
  viewer.onClip((clip) => clips.push(clip));
  await serving.start();
  await until(() => viewer.state.phase === "live", "live");
  await viewer.record(true);
  await tick(20);
  await viewer.record(false);
  await until(() => clips.length === 1, "the clip", 8000);
  eqn("a stop during the start still sends the clip", clips[0]?.durationMs, 3200);
  await until(() => viewer.state.phase === "live", "live again");
  deep("the camera records and cuts once after a slow start", camera.calls.filter((c) => c[0] === "record" || c[0] === "cut"), [["record"], ["cut"]]);
  serving.close();
  viewer.close();
}

{
  const rooms = roomPair();
  const serving = served(rooms.camera, fakeCamera());
  const viewer = viewerOf(rooms.viewer);
  const photos: Array<{ blob: Blob } | null> = [];
  viewer.onPhoto((photo) => photos.push(photo));
  await serving.start();
  await until(() => viewer.state.phase === "live", "live");
  await viewer.record(true);
  await until(() => viewer.state.phase === "recording", "recording");
  await viewer.shoot(0);
  await until(() => photos.length === 1, "an answer");
  eqn("a shutter that cannot be taken answers null", photos[0], null);
  serving.close();
  viewer.close();
}

{
  const rooms = roomPair();
  const camera = fakeCamera();
  const serving = served(rooms.camera, camera);
  const viewer = viewerOf(rooms.viewer);
  await serving.start();
  await until(() => viewer.state.phase === "live", "live");
  deep("the camera starts at the stream's own clip size", camera.sizes, ["1920x1440"]);
  await viewer.set("video", { width: 3840, height: 2160, frameRate: 30 });
  await until(() => camera.sizes.length === 2, "a restart");
  eq("a new clip size restarts the camera at it", camera.sizes[1], "3840x2160");
  await viewer.set("video", { width: 3840, height: 2160, frameRate: 30 });
  await tick(30);
  eqn("the same size starts nothing", camera.sizes.length, 2);
  serving.close();
  viewer.close();
}

done();
