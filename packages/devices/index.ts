/**
 * @file @lightstart/devices: a driver registry, the devices controller, and
 * generic BLE, Wi-Fi, download and preview transports over the light mobile
 * shell. A driver package (such as `@lightstart/gopro`) registers itself
 * explicitly with `registerDriver`.
 */

export { driverById, driverFor, getDrivers, registerDriver, scanServices } from "./lib/registry.js";
export { bytesToHex, chunk, hexToBytes } from "./lib/frame.js";
export { hasNativeDevices, selectTransport } from "./controllers/devices/select-transport.js";
export { createNativeTransport } from "./controllers/devices/transport-native.js";
export { createNullTransport } from "./lib/transport-null.js";
export { installDeviceSignals } from "./signals.js";

export type {
  Advertisement,
  BleTransport,
  ConnectedDevice,
  ConnectTarget,
  DeviceControl,
  DeviceControlOption,
  DeviceDriver,
  DeviceRecord,
  DeviceStatus,
  DownloadProgress,
  DriverSession,
  ImportedFile,
  MediaItem,
  NetTransport,
  PreviewFrame,
  PreviewSignal,
  PreviewState,
  PreviewStats,
  PreviewTransport,
  ScannedDevice,
  TimerHandle,
  Transport,
  WifiTransport,
} from "./types.ts";
