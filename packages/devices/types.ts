import type { TypeDefinition } from "@lightstart/light/types";

export interface Advertisement {
  id: string;
  name?: string;
  rssi?: number;
  services?: string[];
}

export interface ScannedDevice extends Advertisement {
  driverId: string;
  driverLabel: string;
}

export interface DeviceRecord {
  id: string;
  driver: string;
  name: string;
  capabilities: string[];
  wifiSsid: string;
  wifiPass: string;
  autoConnect: boolean;
  lastSeenAt: string;
  createdAt: string;
}

export interface MediaItem {
  name: string;
  dir: string;
  path: string;
  sizeBytes: number;
  capturedAt: string;
  durationMs: number;
}

export interface ImportedFile {
  url: string;
  name: string;
  bytes: number;
  remotePath: string;
  capturedAt: string;
  durationMs: number;
}

export interface BleTransport {
  scan(opts: { services: string[]; timeoutMs: number }): Promise<Advertisement[]>;
  stopScan(): Promise<void>;
  connect(id: string): Promise<unknown>;
  disconnect(id: string): Promise<unknown>;
  subscribe(id: string, char: string): Promise<unknown>;
  write(id: string, char: string, bytes: number[], withResponse?: boolean): Promise<unknown>;
  read(id: string, char: string): Promise<number[]>;
  onNotify(id: string, char: string, cb: (bytes: number[]) => void): () => void;
  onState(id: string, cb: (state: { connected: boolean; reason?: string }) => void): () => void;
  /** Only a transport whose OS asks for pairing out of band has one. */
  onPairing?(cb: (state: { pairing?: boolean }) => void): () => void;
}

export interface WifiTransport {
  join(opts: { ssid: string; password: string; timeoutMs?: number }): Promise<{ handle: string }>;
  leave(handle: string): Promise<unknown>;
}

export interface NetTransport {
  getJson(url: string, handle?: string): Promise<unknown>;
  fetchToFile(opts: {
    url: string;
    name: string;
    handle?: string;
    onProgress?: (p: { bytes: number; total: number }) => void;
  }): Promise<{ url: string; bytes: number; path: string }>;
}

export interface PreviewFrame {
  url: string;
  width: number;
  height: number;
}

export type PreviewState = "off" | "starting" | "buffering" | "live" | "error";

/** What the transport reports. `tracks` is a diagnostic ping, never a rendered state. */
export type PreviewSignal = PreviewState | "tracks";

/** The last thing the transport said about the picture, as emitted alongside the state. */
export interface PreviewStats {
  state?: PreviewSignal;
  code?: string;
  bind?: string;
}

export interface PreviewTransport {
  start(opts: { port?: number; handle?: string; fit?: "contain" | "cover" }): Promise<unknown>;
  stop(): Promise<unknown>;
  /** Window the picture into a rect of CSS pixels; empty means fill the screen. */
  bounds(rect: { x?: number; y?: number; width?: number; height?: number; fit?: string }): Promise<unknown>;
  snapshot(): Promise<PreviewFrame>;
  onState(cb: (data: { state: PreviewSignal; code?: string; bind?: string }) => void): () => void;
}

export interface Transport {
  available(): boolean;
  ble: BleTransport;
  wifi: WifiTransport;
  net: NetTransport;
  preview: PreviewTransport;
}

export interface DeviceControlOption {
  value: number | string;
  label: string;
}

/**
 * One thing about a device the user can change, as a fixed list of choices.
 * `options` being present is the type: a numeric-range control can be added
 * the day something needs one.
 */
export interface DeviceControl {
  id: string;
  label: string;
  options: DeviceControlOption[];
  value: number | string | null;
  /** Changing this alters what the live picture shows, not just what is recorded. */
  affectsPreview?: boolean;
}

export interface DeviceStatus {
  battery?: number;
  recording?: boolean;
  durationMs?: number;
  mode?: "video" | "photo";
}

/** What the native shell reports while it writes a downloaded media file. */
export interface DownloadProgress {
  name: string;
  bytes: number;
  total: number;
}

export interface DriverSession {
  capabilities: string[];
  status?(): Promise<DeviceStatus>;
  startRecording?(): Promise<void>;
  stopRecording?(): Promise<void>;
  listMedia?(opts?: { since?: string }): Promise<MediaItem[]>;
  importMedia?(
    items: MediaItem[],
    opts: { onProgress?: (done: number, total: number) => void },
  ): Promise<ImportedFile[]>;
  keepAlive?(): Promise<void>;
  startPreview?(opts?: { fit?: "contain" | "cover" }): Promise<unknown>;
  stopPreview?(): Promise<void>;
  setMode?(mode: "video" | "photo"): Promise<string>;
  capturePhoto?(): Promise<void>;
  listControls?(): Promise<DeviceControl[]>;
  setControl?(id: string, value: number | string): Promise<void>;
  on(
    event: "status" | "recording" | "state" | "credentials" | "controls",
    cb: (data: any) => void,
  ): () => void;
  close(): Promise<void>;
}

export interface DeviceDriver {
  id: string;
  label: string;
  capabilities: string[];
  scanFilter: { services: string[]; namePrefixes?: string[] };
  matches(advertisement: Advertisement): boolean;
  connect(
    transport: Transport,
    device: { id: string; name?: string; wifiSsid?: string; wifiPass?: string },
  ): Promise<DriverSession>;
}

/** The device the controller currently holds a session to. */
export interface ConnectedDevice {
  id: string;
  name: string;
  driverId: string;
  capabilities: string[];
}

/**
 * What `connect()` takes beside an id: a scanned advertisement, or a stored row
 * normalised by `_known()`. A stored row names its driver `driver`, so both keys
 * may be present and either may be missing.
 */
export type ConnectTarget = Advertisement & {
  driverId?: string;
  driver?: string;
  wifiSsid?: string;
  wifiPass?: string;
  autoConnect?: boolean;
  capabilities?: string[];
  lastSeenAt?: string;
  createdAt?: string;
};

/** Whatever `setTimeout`/`setInterval` hands back in the runtime being checked. */
export type TimerHandle = ReturnType<typeof setTimeout>;

/**
 * The `T.*` property-descriptor cast idiom: `Prop<V>` on a `properties` entry
 * surfaces as `this.key: V` (reactive) or a plain `reactive: false` field.
 */
export type Prop<V> = TypeDefinition<V>;
