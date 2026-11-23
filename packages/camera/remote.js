/**
 * A phone as another phone's camera, over a peer room (`@lightstart/p2p`
 * joined with `video`). The camera side runs the camera, puts its track on
 * the room, tells the viewer what its camera can set and what it is set to
 * (once on start, then its settings every second), takes a setting or a
 * lens the viewer asks for, and answers the shutter: the self-timer, the
 * shot, the photo sent back as one message. The viewer side shows that
 * track, works the settings, the shutter, the timer and the lens, and
 * receives the photo. Both take the room as an argument, so this module
 * imports nothing of p2p; every message is an action on the room, named in
 * `REMOTE_ACTIONS`.
 */

/** @import { CameraInstance, Facing, RemoteCamera, RemoteCaps, RemoteClip, RemotePhoto, RemoteRoom, RemoteState, RemoteViewer } from "./types.ts" */

export const REMOTE_ACTIONS = {
  state: "cam:state",
  photo: "cam:photo",
  shoot: "cam:shoot",
  cancel: "cam:cancel",
  flip: "cam:flip",
  live: "cam:live",
  caps: "cam:caps",
  settings: "cam:settings",
  set: "cam:set",
  lens: "cam:lens",
  record: "cam:record",
  clip: "cam:clip",
};

const CLIP_PART = 768 * 1024;
/** The sizes a photo comes back at, as the long side; 0 is the camera's own. */
export const PHOTO_SIZES = [{ width: 1200, height: 1600, label: "2MP" }, { width: 2448, height: 3264, label: "8MP" }, { width: 0, height: 0, label: "Full" }];
const DEFAULT_PHOTO_SIDE = 1600;

/** @param {string} id a `WxH` id from `PHOTO_SIZES`; 0 is the camera's own size */
const longSide = (id) => Math.max(...String(id).split("x").map((n) => Number(n) || 0));

const SETTINGS_EVERY_MS = 1000;
const STREAM_SIZE = { width: 1920, height: 1440 };
const OPEN_FOR_MS = 10000;
const OPEN_RETRY_MS = 400;

/** @param {unknown} value */
const plain = (value) => JSON.parse(JSON.stringify(value ?? null));

/** @param {Blob} blob */
const toBase64 = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};

/** @param {string} data @param {string} type */
const fromBase64 = (data, type) => {
  const text = atob(data);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return new Blob([bytes], { type });
};

/** @template T @param {Set<(value: T) => void>} handlers @param {T} value */
const emit = (handlers, value) => {
  for (const handler of handlers)
    try { handler(value); } catch (e) { console.warn("[camera/remote] handler threw:", e); }
};

/**
 * The phone that is the camera. `start()` opens the camera (call it from the
 * page the person holds, so the permission prompt shows there); the viewer
 * turns it off and on as its camera screen closes and opens.
 *
 * @param {{ room: RemoteRoom, camera: CameraInstance, facing?: Facing, prepare?: (blob: Blob, longSide: number) => Promise<Blob> }} options
 * @returns {RemoteCamera}
 */
export const serveCamera = ({ room, camera, facing = "environment", prepare = async (blob) => blob }) => {
  /** @type {RemoteState} */
  let state = { phase: "off", count: 0, facing };
  /** @type {Set<(state: RemoteState) => void>} */
  const handlers = new Set();
  /** @type {ReturnType<typeof setInterval> | null} */
  let ticker = null;
  /** @type {ReturnType<typeof setInterval> | null} */
  let pulse = null;
  /** @type {string} */
  let deviceId = "";
  /** @type {unknown[]} */
  let lenses = [];
  let photoSide = DEFAULT_PHOTO_SIDE;
  /** @type {{ width: number, height: number, frameRate?: number } | null} */
  let videoSize = null;

  const photoSizeId = () => {
    const preset = PHOTO_SIZES.find((p) => Math.max(p.width, p.height) === photoSide);
    return preset ? `${preset.width}x${preset.height}` : `${photoSide}x${photoSide}`;
  };
  const settings = () => ({ ...plain(camera.getSettings()), photoSize: photoSizeId() });
  const sendSettings = () => room.action(REMOTE_ACTIONS.settings).send(settings()).catch(() => {});
  /** @param {string} [to] */
  const sendCaps = (to) => room.action(REMOTE_ACTIONS.caps).send({ capabilities: { ...plain(camera.getCapabilities()), photoSizes: PHOTO_SIZES }, settings: settings(), lenses: plain(lenses), deviceId, kind: camera.backend?.kind ?? "web" }, to).catch(() => {});
  const stopPulse = () => {
    if (pulse) clearInterval(pulse);
    pulse = null;
  };

  /** @param {Partial<RemoteState>} patch */
  const set = (patch) => {
    state = { ...state, ...patch };
    emit(handlers, state);
    room.action(REMOTE_ACTIONS.state).send(state).catch(() => {});
  };

  const stopTicker = () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
  };

  const open = async () => {
    const until = Date.now() + OPEN_FOR_MS;
    for (;;)
      try {
        return await camera.start({ ...(deviceId ? { deviceId } : { facingMode: state.facing }), ...(videoSize ?? STREAM_SIZE) });
      } catch (e) {
        if (Date.now() >= until) throw e;
        await new Promise((r) => setTimeout(r, OPEN_RETRY_MS));
      }

  };

  const start = async () => {
    stopTicker();
    stopPulse();
    set({ phase: "starting", count: 0 });
    try {
      const started = await open();
      await room.setTrack(started.track);
      lenses = started.lenses ?? [];
      deviceId = camera.getSettings().deviceId || deviceId;
      set({ phase: "live" });
      sendCaps();
      pulse = setInterval(sendSettings, SETTINGS_EVERY_MS);
    } catch {
      await room.setTrack(null);
      set({ phase: "denied" });
    }
  };

  const stop = async () => {
    stopTicker();
    stopPulse();
    if (state.phase === "recording") await camera.stopRecording().catch(() => null);
    camera.stop();
    await room.setTrack(null);
    set({ phase: "off", count: 0 });
  };

  const take = async () => {
    set({ phase: "sending", count: 0 });
    const shot = (await camera.capturePhoto().catch(() => null))?.blob;
    if (!shot) return set({ phase: "live" });
    const blob = photoSide > 0 ? await prepare(shot, photoSide).catch(() => shot) : shot;
    await room.action(REMOTE_ACTIONS.photo).send({ type: blob.type || "image/jpeg", data: await toBase64(blob), facing: state.facing, at: new Date().toISOString() }).catch(() => {});
    set({ phase: "live" });
  };

  /**
   * The size the viewer records at: the camera starts at it, since a phone
   * chooses its clip size when the camera starts, and restarts when it changes.
   * @param {unknown} value `{ width, height, frameRate }`, or nothing for the stream's own size
   */
  const sizeVideo = async (value) => {
    const asked = /** @type {{ width?: number, height?: number, frameRate?: number } | null} */ (value);
    const next = asked?.width && asked?.height ? { width: Number(asked.width), height: Number(asked.height), ...(asked.frameRate ? { frameRate: Number(asked.frameRate) } : {}) } : null;
    if (JSON.stringify(next) === JSON.stringify(videoSize)) return;
    videoSize = next;
    if (state.phase === "live") await start();
  };

  /** @type {Promise<boolean> | null} */
  let starting = null;
  const phaseNow = () => state.phase;

  const record = async () => {
    if (state.phase !== "live") return;
    set({ phase: "recording", count: 0 });
    starting = camera.startRecording({ audio: false }).then(() => true, () => false);
    if (!(await starting) && phaseNow() === "recording") set({ phase: "live" });
  };

  const cut = async () => {
    if (state.phase !== "recording") return;
    set({ phase: "sending", count: 0 });
    const started = await (starting ?? Promise.resolve(true));
    starting = null;
    const clip = started ? await camera.stopRecording().catch(() => null) : null;
    if (clip?.blob) {
      const data = await toBase64(clip.blob);
      const id = `${Date.now()}`;
      const total = Math.max(1, Math.ceil(data.length / CLIP_PART));
      for (let index = 0; index < total; index++)
        await room.action(REMOTE_ACTIONS.clip).send({ id, index, total, type: clip.blob.type || clip.mime || "video/webm", ext: clip.ext || "webm", durationMs: clip.durationMs, data: data.slice(index * CLIP_PART, (index + 1) * CLIP_PART) }).catch(() => {});
    } else await room.action(REMOTE_ACTIONS.clip).send({ id: `${Date.now()}`, index: 0, total: 0 }).catch(() => {});
    set({ phase: "live" });
  };

  /** @param {number} timer */
  const shoot = (timer) => {
    if (state.phase !== "live") return void room.action(REMOTE_ACTIONS.photo).send({}).catch(() => {});
    if (!timer) return void take();
    set({ phase: "counting", count: timer });
    ticker = setInterval(() => {
      const count = state.count - 1;
      if (count > 0) return set({ count });
      stopTicker();
      take();
    }, 1000);
  };

  const offs = [
    room.action(REMOTE_ACTIONS.shoot).on((data) => shoot(Number(/** @type {{ timer?: number } | null} */ (data)?.timer) || 0)),
    room.action(REMOTE_ACTIONS.cancel).on(() => {
      if (state.phase !== "counting") return;
      stopTicker();
      set({ phase: "live", count: 0 });
    }),
    room.action(REMOTE_ACTIONS.flip).on(() => {
      state = { ...state, facing: state.facing === "user" ? "environment" : "user" };
      deviceId = "";
      if (state.phase === "off") return set({});
      start();
    }),
    room.action(REMOTE_ACTIONS.set).on(async (data) => {
      const { key, value } = /** @type {{ key?: string, value?: unknown }} */ (data ?? {});
      if (!key || state.phase === "off" || state.phase === "denied") return;
      if (key === "photoSize") photoSide = longSide(String(value));
      else if (key === "video") await sizeVideo(value);
      else await camera.applyControl(key, value).catch(() => {});
      sendSettings();
    }),
    room.action(REMOTE_ACTIONS.lens).on((data) => {
      const wanted = String(/** @type {{ deviceId?: string } | null} */ (data)?.deviceId || "");
      if (!wanted || wanted === deviceId) return;
      deviceId = wanted;
      if (state.phase === "off") return;
      start();
    }),
    room.action(REMOTE_ACTIONS.live).on((data) => {
      const on = !!(/** @type {{ on?: boolean } | null} */ (data)?.on);
      if (on && (state.phase === "off" || state.phase === "denied")) start();
      if (!on && state.phase !== "off") stop();
    }),
    room.action(REMOTE_ACTIONS.record).on((data) => {
      const on = !!(/** @type {{ on?: boolean } | null} */ (data)?.on);
      if (on) void record();
      else void cut();
    }),
    room.onPeerJoin((peerId) => {
      room.action(REMOTE_ACTIONS.state).send(state, peerId).catch(() => {});
      if (state.phase === "live") sendCaps(peerId);
    }),
  ];

  return {
    get state() { return state; },
    start,
    stop,
    shoot,
    onState: (handler) => { handlers.add(handler); return () => handlers.delete(handler); },
    close: () => {
      for (const off of offs) off();
      stopTicker();
      stopPulse();
      camera.stop();
      room.setTrack(null).catch(() => {});
    },
  };
};

/**
 * The phone that shows the other phone's camera and keeps the photos.
 *
 * @param {{ room: RemoteRoom }} options
 * @returns {RemoteViewer}
 */
export const viewCamera = ({ room }) => {
  /** @type {RemoteState} */
  let state = { phase: "off", count: 0, facing: "environment" };
  let peerId = "";
  /** @type {MediaStreamTrack | null} */
  let track = null;
  /** @type {Set<(state: RemoteState) => void>} */
  const stateHandlers = new Set();
  /** @type {Set<(photo: RemotePhoto | null) => void>} */
  const photoHandlers = new Set();
  /** @type {Set<(track: MediaStreamTrack | null) => void>} */
  const trackHandlers = new Set();
  /** @type {Set<(caps: RemoteCaps) => void>} */
  const capsHandlers = new Set();
  /** @type {Set<(settings: Record<string, unknown>) => void>} */
  const settingsHandlers = new Set();
  /** @type {Set<(clip: RemoteClip | null) => void>} */
  const clipHandlers = new Set();
  /** @type {RemoteCaps} */
  let caps = { capabilities: {}, settings: {}, lenses: [], deviceId: "", kind: "web" };
  /** @type {{ id: string, parts: string[], got: number, total: number, type: string, ext: string, durationMs: number } | null} */
  let clip = null;

  /** @param {string} name @param {unknown} data */
  const send = (name, data) => room.action(name).send(data, peerId || undefined);

  const offs = [
    room.action(REMOTE_ACTIONS.caps).on((data, from) => {
      peerId = from;
      caps = /** @type {RemoteCaps} */ ({ capabilities: {}, settings: {}, lenses: [], deviceId: "", kind: "web", .../** @type {Partial<RemoteCaps>} */ (data ?? {}) });
      emit(capsHandlers, caps);
      emit(settingsHandlers, caps.settings);
    }),
    room.action(REMOTE_ACTIONS.settings).on((data) => {
      caps = { ...caps, settings: /** @type {Record<string, unknown>} */ (data ?? {}) };
      emit(settingsHandlers, caps.settings);
    }),
    room.action(REMOTE_ACTIONS.clip).on((data) => {
      const part = /** @type {{ id: string, index: number, total: number, type?: string, ext?: string, durationMs?: number, data?: string }} */ (data);
      if (!part.total) {
        clip = null;
        emit(clipHandlers, null);
        return;
      }
      if (!clip || clip.id !== part.id) clip = { id: part.id, parts: new Array(part.total).fill(""), got: 0, total: part.total, type: part.type || "video/webm", ext: part.ext || "webm", durationMs: part.durationMs || 0 };
      if (!clip.parts[part.index]) clip.got++;
      clip.parts[part.index] = part.data || "";
      if (clip.got < clip.total) return;
      const whole = clip;
      clip = null;
      emit(clipHandlers, { blob: fromBase64(whole.parts.join(""), whole.type), mime: whole.type, ext: whole.ext, durationMs: whole.durationMs });
    }),
    room.action(REMOTE_ACTIONS.state).on((data, from) => {
      peerId = from;
      state = /** @type {RemoteState} */ (data);
      emit(stateHandlers, state);
    }),
    room.action(REMOTE_ACTIONS.photo).on((data) => {
      const photo = /** @type {{ type?: string, data?: string, facing?: Facing, at?: string } | null} */ (data);
      emit(photoHandlers, photo?.data ? { blob: fromBase64(photo.data, photo.type || "image/jpeg"), facing: photo.facing || "environment", at: photo.at || new Date().toISOString() } : null);
    }),
    room.onTrack((from, next) => {
      peerId = from;
      track = next;
      emit(trackHandlers, next);
    }),
    room.onPeerLeave((id) => {
      if (id !== peerId) return;
      peerId = "";
      track = null;
      state = { ...state, phase: "gone", count: 0 };
      caps = { capabilities: {}, settings: {}, lenses: [], deviceId: "", kind: "web" };
      emit(trackHandlers, null);
      emit(stateHandlers, state);
      emit(capsHandlers, caps);
    }),
  ];

  return {
    get state() { return state; },
    get track() { return track; },
    get connected() { return !!peerId; },
    get caps() { return caps; },
    shoot: (timer = 0) => send(REMOTE_ACTIONS.shoot, { timer }),
    cancel: () => send(REMOTE_ACTIONS.cancel, {}),
    flip: () => send(REMOTE_ACTIONS.flip, {}),
    live: (on) => send(REMOTE_ACTIONS.live, { on }),
    set: (key, value) => send(REMOTE_ACTIONS.set, { key, value }),
    selectLens: (deviceId) => send(REMOTE_ACTIONS.lens, { deviceId }),
    record: (on) => send(REMOTE_ACTIONS.record, { on }),
    onState: (handler) => { stateHandlers.add(handler); return () => stateHandlers.delete(handler); },
    onPhoto: (handler) => { photoHandlers.add(handler); return () => photoHandlers.delete(handler); },
    onTrack: (handler) => { trackHandlers.add(handler); return () => trackHandlers.delete(handler); },
    onCaps: (handler) => { capsHandlers.add(handler); return () => capsHandlers.delete(handler); },
    onSettings: (handler) => { settingsHandlers.add(handler); return () => settingsHandlers.delete(handler); },
    onClip: (handler) => { clipHandlers.add(handler); return () => clipHandlers.delete(handler); },
    close: () => { for (const off of offs) off(); },
  };
};
