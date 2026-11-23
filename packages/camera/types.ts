/**
 * @lightstart/camera public type declarations.
 */

export interface ControlExplain {
  what: string;
  why: string;
  when: string;
}

export interface CameraControl {
  id: string;
  label: string;
  unit: string;
  group: string;
  hardwareKey?: ControlKey;
  /** Phone hardware can never set this (e.g. aperture); always taught via simulation. */
  simulate?: boolean;
  /** Real where the device exposes it, simulated lesson otherwise. */
  simulatable?: boolean;
  /** On/off control rather than a continuous range. */
  toggle?: boolean;
  explain: ControlExplain;
}

export interface ControlRange {
  min: number;
  max: number;
  step: number;
}

export interface ResolvedControl extends CameraControl {
  supported: boolean;
  simulated: boolean;
  range: ControlRange | null;
  capability: unknown;
}

export interface LensInfo {
  lensType: string;
  lensLabel: string;
  nominalMm: number;
}

export interface LensDevice extends LensInfo {
  deviceId: string;
  label: string;
  /** Reported by the native shell for a lens it can zoom to; absent on the web. */
  zoomRatio?: number;
}

export interface ZoomDescription {
  zoom: number;
  mm: number;
  label: string;
}

export interface CameraExif {
  focalLength: number | null;
  focalLength35: number | null;
  fNumber: number | null;
  exposureTime: string | null;
  exposureSeconds: number | null;
  iso: number | null;
}

/** The `devices` controller handle the device backend reads: its preview, controls, shutter and media. */
export interface DevicesSlot {
  available: boolean;
  device?: { id: string } | null;
  previewState: string;
  error: string;
  controls: Array<{ id: string; label: string; options: Array<{ value: number | string; label: string }>; value: number | string | null }>;
  isReady: () => boolean;
  startPreview: (opts?: { fit?: "contain" | "cover"; expires?: boolean }) => Promise<boolean>;
  stopPreview?: () => Promise<void>;
  setPreviewBounds?: (rect: { x?: number; y?: number; width?: number; height?: number; fit?: string } | null) => void;
  capturePreviewFrame: () => Promise<string | { url: string } | null>;
  capturePhoto?: () => Promise<unknown>;
  startRecording: () => Promise<unknown>;
  stopRecording: () => Promise<unknown>;
  setControl: (id: string, value: number | string) => Promise<boolean>;
  $state?: { subscribe?: (key: string, cb: () => void) => () => void };
}

/** A capture whose full-size file is still on the camera that made it. */
export interface PendingCapture {
  deviceId: string;
  at: string;
}

/** What to keep of a press: the phone's JPEG, or the sensor's DNG beside it. */
export type KeepFormat = "jpeg" | "raw";

export interface PhotoResult {
  blob: Blob | null;
  /** The sensor's data as a DNG, when the press asked for RAW and the camera gives it. */
  raw?: Blob | null;
  exif: CameraExif | null;
  settings: CameraSettings;
  pending?: PendingCapture;
  /** Where the mobile shell still serves the file (`/__mobile/native/...`), so it can be handed on without crossing the bridge. */
  served?: string;
}

export interface RecordingResult {
  blob: Blob | null;
  /** Where the mobile shell still serves the file (`/__mobile/native/...`). */
  served?: string;
  durationMs: number;
  mime: string;
  ext: string;
  pending?: PendingCapture;
}

/** A lens the camera reports, with the short label the chip strip draws. */
export interface EnrichedLens extends LensDevice {
  chipLabel: string;
}

/** One JPEG size a camera can shoot, as the native shell reports it. */
export interface PhotoSize {
  id: string;
  w: number;
  h: number;
  mp: number;
}

/** The track constraint a control drives on real hardware, standard or vendor. */
export type ControlKey =
  | "zoom"
  | "exposureCompensation"
  | "iso"
  | "exposureTime"
  | "colorTemperature"
  | "focusDistance"
  | "torch";

/** The range a device reports for one control. */
export interface CapabilityRange {
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Track settings as a backend reports them: the web backend returns the track's
 * own settings, the native shell sends JSON with vendor keys (`zoom`, `iso`,
 * `photoSize`, an aspect ratio written `"16:9"`).
 */
export type CameraSettings = { [K in ControlKey]?: number | boolean } & {
  width?: number,
  height?: number,
  deviceId?: string,
  facingMode?: string,
  /** The bound ratio as a label ("4:3", "16:9"): the one representation, the same as `CameraCapabilities.aspectRatios`. */
  aspectRatio?: string,
  photoSize?: string,
  /** What the camera is bound to keep of a press, `jpeg` or `raw` (the DNG beside the JPEG). */
  keep?: KeepFormat,
  /** The frame standing up or lying down. */
  orientation?: "portrait" | "landscape",
  /** The size a clip is kept at, `WxH` as the recorder was bound, upright. */
  clip?: string,
};

/** What a backend reports the current camera can do: the track's own capabilities plus the vendor keys the native shell adds. */
export type CameraCapabilities = MediaTrackCapabilities & {
  zoom?: CapabilityRange,
  exposureCompensation?: CapabilityRange,
  iso?: CapabilityRange,
  exposureTime?: CapabilityRange,
  colorTemperature?: CapabilityRange,
  focusDistance?: CapabilityRange,
  torch?: boolean | boolean[],
  aspectRatios?: string[],
  photoSizes?: PhotoSize[],
  videoQualities?: string[],
  /** The camera writes the sensor's DNG beside the JPEG in one press. */
  raw?: boolean;
  /** The frames the camera can keep, standing up or lying down. */
  orientations?: Array<"portrait" | "landscape">;
  /** Whether a still can be taken while a clip records; false where the recorder needed the stream. */
  stills?: boolean;
};

export interface StartResult {
  stream: MediaStream | null;
  track: MediaStreamTrack | null;
}

export type Unsubscribe = () => void;

export interface CameraBackend {
  kind: string;
  isSupported: () => boolean;
  on: (type: string, cb: (data: any) => void) => Unsubscribe;
  start: (opts?: CameraStartOptions) => Promise<StartResult>;
  stop: () => void;
  attachTo: (el: HTMLVideoElement | null) => void;
  getStream: () => MediaStream | null;
  getCapabilities: () => CameraCapabilities;
  getSettings: () => CameraSettings;
  applyControl: (key: string, value: unknown) => Promise<CameraSettings>;
  capturePhoto: (opts?: { keep?: KeepFormat }) => Promise<PhotoResult>;
  startRecording: (opts?: RecordingOptions) => Promise<void>;
  stopRecording: () => Promise<RecordingResult | null>;
  listLenses: () => Promise<LensDevice[]>;
  switchLens: (deviceId: string) => Promise<StartResult>;
  setBounds?: (rect: { x?: number; y?: number; width?: number; height?: number } | null) => void;
}

export interface CameraInstance {
  backend: CameraBackend;
  start: (constraints?: CameraStartOptions) => Promise<StartResult & { lenses: EnrichedLens[], activeLens: EnrichedLens | null }>;
  stop: () => void;
  on: CameraBackend["on"];
  attachTo: CameraBackend["attachTo"];
  getStream: CameraBackend["getStream"];
  getCapabilities: CameraBackend["getCapabilities"];
  getSettings: CameraBackend["getSettings"];
  applyControl: CameraBackend["applyControl"];
  capturePhoto: CameraBackend["capturePhoto"];
  startRecording: CameraBackend["startRecording"];
  stopRecording: CameraBackend["stopRecording"];
  setBounds: (rect: { x?: number; y?: number; width?: number; height?: number } | null) => void;
  listLenses: CameraBackend["listLenses"];
  switchLens: CameraBackend["switchLens"];
  resolveControls: () => ResolvedControl[];
  currentMm: () => ZoomDescription & { hint: string };
  readonly activeLens: EnrichedLens | null;
}

export interface CameraModule {
  createCamera: (opts?: Record<string, unknown>) => CameraInstance;
  isSupported: () => boolean;
  isNativeShell: () => boolean;
  controls: CameraControl[];
  controlById: (id: string) => CameraControl | null;
  classifyLens: (label?: string) => LensInfo;
  effectiveMm: (nominalMm: number, zoomRatio?: number) => number;
  describeZoom: (nominalMm: number, zoomRatio?: number) => ZoomDescription;
  focalLengthHint: (mm: number) => string;
}

/** A camera link's contents: the app, the room, its key, the signalers, the relay, and when it stops working. */
export interface CameraPair {
  v: number;
  a: string;
  r: string;
  p: string;
  s: string[];
  u?: string;
  exp: number;
}

/** Which way a phone's camera looks. */
/** The camera's sounds (`lib/sound.js`), one Web Audio context per set. */
export interface CameraSounds {
  /** A short tone: frequency in Hz, length in ms, gain from 0 to 1. */
  beep(frequency?: number, ms?: number, gain?: number): void;
  /** The shutter: two bursts of noise, the second a touch later and lower. */
  click(): void;
  /** One tick of a self-timer, the last second higher. */
  tick(count: number): void;
}

export type Facing = "user" | "environment";

/**
 * What `remote.js` needs of a peer room: `@lightstart/p2p`'s `Room` joined
 * with `video` satisfies it. Described here so the camera depends on no p2p
 * code at run time.
 */
export interface RemoteRoom {
  action(name: string): { send(data: unknown, to?: string | string[]): Promise<void>; on(handler: (data: unknown, from: string) => void): () => void };
  setTrack(track: MediaStreamTrack | null): Promise<void>;
  onTrack(handler: (peerId: string, track: MediaStreamTrack) => void): () => void;
  onPeerJoin(handler: (peerId: string) => void): () => void;
  onPeerLeave(handler: (peerId: string) => void): () => void;
}

/** Where the camera phone stands: `gone` is the viewer's word for a camera that left the room. */
export interface RemoteState {
  phase: "off" | "starting" | "live" | "counting" | "recording" | "sending" | "denied" | "gone";
  count: number;
  facing: Facing;
}

/** What the camera phone's camera can set and is set to, with its lenses. */
export interface RemoteCaps {
  capabilities: Record<string, unknown>;
  settings: Record<string, unknown>;
  lenses: LensDevice[];
  deviceId: string;
  /** The backend the camera phone runs: `native` (its own units: seconds, diopters) or `web`. */
  kind: string;
}

/** A clip the camera phone recorded and sent back in parts. */
export interface RemoteClip {
  blob: Blob;
  mime: string;
  ext: string;
  durationMs: number;
}

/** A photo the camera phone took and sent. */
export interface RemotePhoto {
  blob: Blob;
  facing: Facing;
  at: string;
}

export interface RemoteCamera {
  readonly state: RemoteState;
  start(): Promise<void>;
  stop(): Promise<void>;
  shoot(timer: number): void;
  onState(handler: (state: RemoteState) => void): () => void;
  close(): void;
}

/** The `cameraLink` controller as the link backend reads it: the other phone's stream, settings and shutter. */
export interface CameraLinkSlot {
  stream: MediaStream | null;
  camera: RemoteState;
  remoteKind: string;
  capabilities: Record<string, unknown>;
  settings: Record<string, unknown>;
  lenses: LensDevice[];
  isConnected(): boolean;
  live(on: boolean): Promise<unknown> | undefined;
  shoot(timer?: number): Promise<RemotePhoto | null>;
  flip(): Promise<unknown> | undefined;
  applyControl(key: string, value: unknown): Promise<Record<string, unknown>>;
  selectLens(deviceId: string): Promise<unknown> | undefined;
  startRecording(): Promise<void>;
  stopRecording(): Promise<RemoteClip | null>;
  $state?: { subscribe(key: string, cb: (value: unknown) => void): () => void };
}

export interface RemoteViewer {
  readonly state: RemoteState;
  readonly track: MediaStreamTrack | null;
  readonly connected: boolean;
  readonly caps: RemoteCaps;
  shoot(timer?: number): Promise<void>;
  cancel(): Promise<void>;
  flip(): Promise<void>;
  live(on: boolean): Promise<void>;
  set(key: string, value: unknown): Promise<void>;
  selectLens(deviceId: string): Promise<void>;
  record(on: boolean): Promise<void>;
  onState(handler: (state: RemoteState) => void): () => void;
  onPhoto(handler: (photo: RemotePhoto | null) => void): () => void;
  onTrack(handler: (track: MediaStreamTrack | null) => void): () => void;
  onCaps(handler: (caps: RemoteCaps) => void): () => void;
  onSettings(handler: (settings: Record<string, unknown>) => void): () => void;
  onClip(handler: (clip: RemoteClip | null) => void): () => void;
  close(): void;
}

/** What `start()` is asked for: a device or a facing, and the shape of the stream. */
export interface CameraStartOptions {
  deviceId?: string;
  facingMode?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  audio?: boolean;
  /** What a press keeps: the JPEG, or the sensor's DNG beside it where the camera gives one. */
  keep?: KeepFormat;
  /** The frame standing up or lying down: what is kept is the frame the screen shows, whichever way the phone is held. */
  orientation?: "portrait" | "landscape";
}

/** What `startRecording()` is asked for. */
export interface RecordingOptions {
  timeslice?: number;
  mimeType?: string;
  audio?: boolean;
}

/** The `T.*` property-descriptor cast idiom: `Prop<V>` on a `properties` entry surfaces as `this.key: V`. */
export type Prop<V> = import("@lightstart/light/types").TypeDefinition<V>;
