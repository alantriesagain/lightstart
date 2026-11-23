/**
 * The camera's own named presets.
 *
 * These matter more than they look: a preset *fixes* resolution and frame rate,
 * which is why the camera reports no options for those settings on their own.
 * Choosing "Standard · 4K" is how you actually change resolution, the same way
 * GoPro's own app does it.
 *
 * @import { DeviceControl } from "@lightstart/devices"
 * @import { Preset, PresetTree } from "../types.ts"
 */
import { SETTING_RESOLUTION, SETTING_FPS } from "./constants.js";
import { labelFor } from "./settings.js";

/** @type {Record<number | string, string>} */
const TITLES = {
  0: "Activity",
  1: "Standard",
  2: "Cinematic",
  3: "Photo",
  4: "Live Burst",
  5: "Burst Photo",
  6: "Night Photo",
  7: "Time Warp",
  8: "Time Lapse",
  9: "Night Lapse",
  10: "Video",
  11: "Slo-Mo",
  13: "Custom",
  16: "Air",
  17: "Bike",
  18: "Epic",
  19: "Indoor",
  20: "Motor",
  21: "Mounted",
  22: "Outdoor",
  23: "POV",
  24: "Selfie",
  25: "Skate",
  26: "Snow",
  27: "Trail",
  28: "Travel",
  29: "Water",
  30: "Looping",
  31: "Stars",
  32: "Action",
  33: "Follow Cam",
  34: "Surf",
  35: "City",
  36: "Shaky",
  37: "Chesty",
  38: "Helmet",
  39: "Bite",
  40: "Custom Cinematic",
  41: "Vlog",
  42: "FPV",
  43: "HDR",
  44: "Landscape",
  45: "Log",
  46: "Cartridge",
  47: "Max Lens",
  100: "Max Video",
  101: "Max Photo",
  102: "Max Time Warp",
};

/** @type {Record<string, string>} */
const GROUP_MODE = {
  PRESET_GROUP_ID_VIDEO: "video",
  PRESET_GROUP_ID_PHOTO: "photo",
  PRESET_GROUP_ID_TIMELAPSE: "video",
};

/** @param {string} name */
const fromEnumName = (name) =>
  String(name)
    .replace(/^PRESET_TITLE_/, "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** @param {Preset} preset */
export const presetTitle = (preset) => {
  const raw = preset?.titleId;
  if (typeof raw === "string") return TITLES[raw] ?? fromEnumName(raw);
  if (typeof raw === "number" && TITLES[raw]) return TITLES[raw];
  return typeof raw === "number" ? `Preset ${raw}` : "Preset";
};

/** @param {Preset} preset @param {number} id */
const settingValue = (preset, id) =>
  (preset?.settingArray ?? []).find((entry) => entry?.id === id)?.value;

/**
 * A preset carries the resolution and frame rate it will shoot at, so the label
 * can say what you're actually choosing rather than making you remember.
 */
/** @param {Preset} preset */
export const presetLabel = (preset) => {
  const title = presetTitle(preset);
  const resolution = labelFor(SETTING_RESOLUTION, settingValue(preset, SETTING_RESOLUTION));
  const fps = labelFor(SETTING_FPS, settingValue(preset, SETTING_FPS));
  const joiner = resolution && /\d$/.test(resolution) ? " " : "";
  const detail = fps ? [resolution, fps].filter(Boolean).join(joiner) : (resolution ?? "");
  return detail ? `${title} · ${detail}` : title;
};

/**
 * `{ presetGroupArray: [{ id, presetArray: [...] }] }` → one control for the
 * groups belonging to the current mode.
 *
 * @param {PresetTree|null} json
 * @param {string} mode "video" | "photo"
 * @param {number|null} activeId
 * @returns {DeviceControl|null}
 */
export const buildPresetControl = (json, mode = "video", activeId = null) => {
  const groups = json?.presetGroupArray ?? [];
  const options = [];
  for (const group of groups) {
    if (GROUP_MODE[group?.id] !== mode) continue;
    for (const preset of group?.presetArray ?? []) {
      if (preset?.id == null) continue;
      options.push({ value: preset.id, label: presetLabel(preset) });
    }
  }
  if (!options.length) return null;
  return {
    id: "preset",
    label: "Preset",
    options,
    value: options.some((option) => option.value === activeId) ? activeId : null,
    affectsPreview: true,
  };
};
