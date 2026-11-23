/**
 * What the camera's settings are called.
 *
 * The split that makes this work: the camera knows which options are valid
 * right now (it changes with the model, the firmware and the current mode),
 * but it only ever sends numbers. The names live here. Neither half is enough
 * on its own, so availability always comes off the wire and never from this
 * table.
 *
 * @import { DeviceControl } from "@lightstart/devices"
 */
import {
  SETTING_RESOLUTION,
  SETTING_FPS,
  SETTING_VIDEO_LENS,
  SETTING_PHOTO_LENS,
} from "./constants.js";

/**
 * `mode` scopes a setting to the preset group it belongs to, so a photo lens
 * never appears while the camera is set up to film.
 */
/** @type {Array<{ id: string, settingId: number, label: string, mode: string, affectsPreview?: boolean, labels: Record<number, string> }>} */
export const SETTINGS = [
  {
    id: "resolution",
    settingId: SETTING_RESOLUTION,
    label: "Resolution",
    mode: "video",
    labels: {
      1: "4K",
      4: "2.7K",
      6: "2.7K 4:3",
      7: "1440p",
      9: "1080p",
      12: "960p",
      18: "4K 4:3",
      24: "5K 4:3",
      25: "5.3K 8:7",
      26: "5.3K 4:3",
      27: "4K 8:7",
      28: "4K 9:16",
      100: "5.3K",
    },
  },
  {
    id: "fps",
    settingId: SETTING_FPS,
    label: "Frame rate",
    mode: "video",
    labels: {
      0: "240",
      1: "120",
      2: "100",
      5: "60",
      6: "50",
      8: "30",
      9: "25",
      10: "24",
      13: "200",
    },
  },
  {
    id: "lens",
    settingId: SETTING_VIDEO_LENS,
    label: "Lens",
    mode: "video",
    affectsPreview: true,
    labels: {
      0: "Wide",
      2: "Narrow",
      3: "SuperView",
      4: "Linear",
      7: "Max SuperView",
      8: "Linear + Horizon",
      9: "HyperView",
      10: "Linear + Lock",
      11: "Max HyperView",
    },
  },
  {
    id: "lens",
    settingId: SETTING_PHOTO_LENS,
    label: "Lens",
    mode: "photo",
    affectsPreview: true,
    labels: { 19: "Narrow", 100: "Max SuperView", 101: "Wide", 102: "Linear" },
  },
];

/**
 * The name for one option of one setting, or undefined when we have none.
 * @param {number} settingId @param {number | null | undefined} value
 */
export const labelFor = (settingId, value) =>
  value == null
    ? undefined
    : SETTINGS.find((setting) => setting.settingId === settingId)?.labels[value];

const seenUnknown = new Set();

/** @param {(typeof SETTINGS)[number]} setting @param {number} value */
const optionLabel = (setting, value) => {
  const known = setting.labels[value];
  if (known) return known;
  const key = `${setting.settingId}:${value}`;
  if (!seenUnknown.has(key)) {
    seenUnknown.add(key);
    globalThis.console?.warn?.(`[gopro] no label for setting ${setting.settingId} option ${value}`);
  }
  return `#${value}`;
};

/**
 * Camera-reported availability crossed with our names.
 *
 * A setting the camera reports no options for is dropped entirely rather than
 * falling back to the table; offering a choice the camera has not blessed is
 * how you write a value it will reject.
 *
 * @param {Record<number, number[]>} capabilities option ids the camera says are valid
 * @param {Record<number, number>} values current value per setting id
 * @param {string} mode "video" | "photo"
 * @returns {DeviceControl[]}
 */
export const buildControls = (capabilities = {}, values = {}, mode = "video") =>
  /** @type {DeviceControl[]} */ (
    SETTINGS.filter((setting) => setting.mode === mode)
      .map((setting) => {
        const available = [...new Set(capabilities[setting.settingId] ?? [])];
        if (!available.length) return null;
        return {
          id: setting.id,
          label: setting.label,
          options: available.map((value) => ({ value, label: optionLabel(setting, value) })),
          value: values[setting.settingId] ?? null,
          ...(setting.affectsPreview ? { affectsPreview: true } : {}),
        };
      })
      .filter(Boolean)
  );

/**
 * The wire id for a control id in the given mode, or undefined.
 * @param {string} id @param {string} [mode]
 */
export const settingIdFor = (id, mode = "video") =>
  SETTINGS.find((setting) => setting.id === id && setting.mode === mode)?.settingId;
