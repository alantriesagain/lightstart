/**
 * @file @lightstart/gopro: a pure-JS GoPro driver for `@lightstart/devices`.
 * Open GoPro BLE control and Wi-Fi media import over the generic device
 * transports. It registers explicitly: an app imports `registerDriver` from
 * `@lightstart/devices` and calls it once with this package's driver.
 */

export { default, default as driver, default as goproDriver } from "./driver.js";
export * from "./lib/constants.js";
export * from "./lib/media.js";
export * from "./lib/presets.js";
export * from "./lib/protocol.js";
export * from "./lib/settings.js";

export type {
  MediaListDir,
  MediaListFile,
  MediaListReply,
  Preset,
  PresetGroup,
  PresetSetting,
  PresetTree,
} from "./types.ts";
