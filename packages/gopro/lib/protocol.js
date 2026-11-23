/**
 * Open GoPro BLE framing. Pure: no shell, no DOM, no transport. Everything the
 * driver puts on or takes off the wire goes through here, which is what makes
 * the protocol testable without a camera.
 */
import {
  CMD_SHUTTER,
  CMD_SLEEP,
  CMD_AP_CONTROL,
  CMD_LOAD_PRESET_GROUP,
  CMD_LOAD_PRESET,
  QUERY_GET_STATUS,
  QUERY_REGISTER_STATUS,
  QUERY_GET_SETTINGS,
  QUERY_GET_CAPABILITIES,
  QUERY_REGISTER_SETTINGS,
  QUERY_REGISTER_CAPABILITIES,
  STATUS_ENCODING,
  STATUS_DURATION,
  STATUS_AP_ON,
  STATUS_BATTERY,
  STATUS_PRESET_GROUP,
  STATUS_ACTIVE_PRESET,
  PRESET_GROUP_VIDEO,
  PRESET_GROUP_PHOTO,
} from "./constants.js";

const MAX_SINGLE_LEN = 0x1f;

/**
 * Prefix a payload with its length. We never emit extended or continuation
 * frames; every command we send is a handful of bytes.
 * @param {number[]} bytes
 * @returns {number[]}
 */
export const encodeCommand = (bytes) => {
  const payload = [...(bytes ?? [])];
  if (payload.length > MAX_SINGLE_LEN) throw new Error("payload-too-long");
  return [payload.length, ...payload];
};

export const SHUTTER_ON = [CMD_SHUTTER, 0x01, 0x01];
export const SHUTTER_OFF = [CMD_SHUTTER, 0x01, 0x00];
export const SLEEP = [CMD_SLEEP];
export const AP_ON = [CMD_AP_CONTROL, 0x01, 0x01];
export const AP_OFF = [CMD_AP_CONTROL, 0x01, 0x00];

/**
 * Switches the camera between its video and photo preset groups. The group id
 * is a 32-bit value but only ever needs its low two bytes.
 * @param {number} group
 */
export const LOAD_PRESET_GROUP = (group) => [
  CMD_LOAD_PRESET_GROUP,
  0x02,
  (group >> 8) & 0xff,
  group & 0xff,
];

export const PRESET_GROUP_FOR = { video: PRESET_GROUP_VIDEO, photo: PRESET_GROUP_PHOTO };

/**
 * Loads one preset by id. Unlike a preset *group*, the id is a full 32 bits.
 * @param {number} presetId
 */
export const LOAD_PRESET = (presetId) => [
  CMD_LOAD_PRESET,
  0x04,
  (presetId >>> 24) & 0xff,
  (presetId >>> 16) & 0xff,
  (presetId >>> 8) & 0xff,
  presetId & 0xff,
];

/** @type {Record<number, "video" | "photo">} */
const MODE_FOR_GROUP = { [PRESET_GROUP_VIDEO]: "video", [PRESET_GROUP_PHOTO]: "photo" };

/** @param {number[]} ids */
export const QUERY_STATUS = (ids) => [QUERY_GET_STATUS, ...ids];
/** @param {number[]} ids */
export const REGISTER_STATUS = (ids) => [QUERY_REGISTER_STATUS, ...ids];

/** @param {number[]} ids */
export const QUERY_SETTINGS = (ids) => [QUERY_GET_SETTINGS, ...ids];
/** @param {number[]} ids */
export const QUERY_CAPABILITIES = (ids) => [QUERY_GET_CAPABILITIES, ...ids];
/** @param {number[]} ids */
export const REGISTER_SETTINGS = (ids) => [QUERY_REGISTER_SETTINGS, ...ids];
/** @param {number[]} ids */
export const REGISTER_CAPABILITIES = (ids) => [QUERY_REGISTER_CAPABILITIES, ...ids];

/**
 * Write one setting. Every setting we touch takes a single byte; a wider value
 * would need its own length, and guessing one silently would be worse than
 * refusing.
 * @param {number} settingId
 * @param {number} value
 */
export const SET_SETTING = (settingId, value) => {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new Error("setting-value-too-wide");
  return [settingId, 0x01, value];
};

/**
 * Body of a capabilities query: repeating `[id, len, ...optionIds]`.
 *
 * The camera repeats a setting's id once per option it offers, so entries
 * accumulate rather than replace; overwriting leaves exactly one option per
 * setting, which looks like a camera with nothing to choose from. Accumulating
 * also copes with the shape where one entry carries several ids at once.
 *
 * @param {number[]} body
 * @returns {Record<number, number[]>}
 */
export const parseSettingLists = (body) => {
  const bytes = [...(body ?? [])];
  /** @type {Record<number, number[]>} */
  const out = {};
  let i = 0;
  while (i + 1 < bytes.length) {
    const id = bytes[i];
    const len = bytes[i + 1];
    if (i + 2 + len > bytes.length) break;
    if (len > 0) out[id] = [...(out[id] ?? []), ...bytes.slice(i + 2, i + 2 + len)];
    i += 2 + len;
  }
  return out;
};

/**
 * Reassembles GoPro's packet framing into whole payloads.
 *
 * A header byte under 0x20 is the payload length. 0x20-0x2f means the length
 * is 13 bits, spread across the low nibble and the next byte. 0x80-0x8f are
 * continuation packets, whose counter we don't need to track because ATT
 * guarantees ordering on a single characteristic.
 */
export const createReassembler = () => {
  let expected = 0;
  /** @type {number[]} */
  let buffer = [];

  const reset = () => {
    expected = 0;
    buffer = [];
  };

  return {
    reset,
    /**
     * @param {number[]} packet
     * @returns {number[]|null} the whole payload, or null while still collecting
     */
    push(packet) {
      const bytes = [...(packet ?? [])];
      if (!bytes.length) return null;
      const header = bytes[0];

      if (header >= 0x80 && header <= 0x8f) {
        if (!expected) return null;
        buffer.push(...bytes.slice(1));
      } else if (header >= 0x20 && header <= 0x2f) {
        if (bytes.length < 2) return null;
        expected = ((header & 0x0f) << 8) | bytes[1];
        buffer = bytes.slice(2);
      } else if (header <= MAX_SINGLE_LEN) {
        expected = header;
        buffer = bytes.slice(1);
      } else {
        reset();
        return null;
      }

      if (!expected || buffer.length < expected) return null;
      const payload = buffer.slice(0, expected);
      reset();
      return payload;
    },
  };
};

/**
 * A reassembled payload is `[requestId, status, ...body]`.
 * @param {number[]} payload
 */
export const parseTlv = (payload) => {
  const bytes = [...(payload ?? [])];
  if (!bytes.length) return { requestId: undefined, status: undefined, body: [] };
  return { requestId: bytes[0], status: bytes[1], body: bytes.slice(2) };
};

/**
 * Body of a status query: repeating `[id, len, ...big-endian value]`.
 * @param {number[]} body
 * @returns {Record<number, number>}
 */
export const parseStatuses = (body) => {
  const bytes = [...(body ?? [])];
  /** @type {Record<number, number>} */
  const out = {};
  let i = 0;
  while (i + 1 < bytes.length) {
    const id = bytes[i];
    const len = bytes[i + 1];
    if (i + 2 + len > bytes.length) break;
    if (len > 0) {
      let value = 0;
      for (let k = 0; k < len; k++) value = value * 256 + bytes[i + 2 + k];
      out[id] = value;
    }
    i += 2 + len;
  }
  return out;
};

/**
 * Named status fields. A field the camera didn't report stays undefined;
 * a missing battery must never read as 0%.
 * @param {Record<number, number>} map
 */
export const decodeStatus = (map = {}) => {
  /** @type {{battery?: number, recording?: boolean, durationMs?: number, apOn?: boolean, mode?: "video"|"photo", presetId?: number}} */
  const out = {};
  if (STATUS_BATTERY in map) out.battery = map[STATUS_BATTERY];
  if (STATUS_ENCODING in map) out.recording = map[STATUS_ENCODING] === 1;
  if (STATUS_DURATION in map) out.durationMs = map[STATUS_DURATION] * 1000;
  if (STATUS_AP_ON in map) out.apOn = map[STATUS_AP_ON] === 1;
  const mode = MODE_FOR_GROUP[map[STATUS_PRESET_GROUP]];
  if (mode) out.mode = mode;
  if (STATUS_ACTIVE_PRESET in map) out.presetId = map[STATUS_ACTIVE_PRESET];
  return out;
};
