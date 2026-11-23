/**
 * GoPro media HTTP surface. Pure: URL building and response shaping only.
 * @import { MediaItem } from "@lightstart/devices"
 * @import { MediaListReply } from "../types.ts"
 */
import { HTTP_BASE } from "./constants.js";

const VIDEO_EXT = new Set(["mp4", "360", "lrv"]);
const IMPORTABLE_EXT = new Set(["mp4"]);

/** @param {string | null | undefined} name */
const ext = (name) => String(name ?? "").split(".").pop()?.toLowerCase() ?? "";

/** @param {string} name */
export const isVideo = (name) => VIDEO_EXT.has(ext(name));
/** @param {string} name */
export const isImportable = (name) => IMPORTABLE_EXT.has(ext(name));

/**
 * `{ media: [{ d: "100GOPRO", fs: [{ n, s, cre, mod, dur }] }] }` → flat items.
 * @param {MediaListReply | null | undefined} json
 * @returns {MediaItem[]}
 */
export const parseMediaList = (json) => {
  const dirs = Array.isArray(json?.media) ? json.media : [];
  const out = [];
  for (const dir of dirs) {
    const name = dir?.d;
    const files = Array.isArray(dir?.fs) ? dir.fs : [];
    if (!name) continue;
    for (const file of files) {
      if (!file?.n) continue;
      const seconds = Number(file.cre);
      out.push({
        name: file.n,
        dir: name,
        path: `${name}/${file.n}`,
        sizeBytes: Number(file.s) || 0,
        capturedAt: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : "",
        durationMs: (Number(file.dur) || 0) * 1000,
      });
    }
  }
  return out;
};

/** @param {MediaItem} item */
export const downloadUrl = (item, base = HTTP_BASE) => `${base}/videos/DCIM/${item.dir}/${item.name}`;
/** @param {MediaItem} item */
export const thumbUrl = (item, base = HTTP_BASE) =>
  `${base}/gopro/media/thumbnail?path=${encodeURIComponent(item.path)}`;

export const MEDIA_LIST_URL = (base = HTTP_BASE) => `${base}/gopro/media/list`;

/**
 * Clips captured at or after `iso`. Inclusive, so a clip started in the same
 * second the session began isn't lost.
 * @param {MediaItem[]} items
 * @param {string} [iso]
 */
export const sinceFilter = (items, iso) => {
  if (!iso) return [...(items ?? [])];
  return (items ?? []).filter((item) => item.capturedAt && item.capturedAt >= iso);
};

/** @param {MediaItem[]} items */
export const totalBytes = (items) => (items ?? []).reduce((sum, item) => sum + (item.sizeBytes || 0), 0);

/** @param {number | string} bytes */
export const formatBytes = (bytes) => {
  const value = Number(bytes) || 0;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${Math.round(value / (1024 * 1024))} MB`;
  return `${Math.round((value / (1024 * 1024 * 1024)) * 10) / 10} GB`;
};

export const STREAM_START_URL = () => `${HTTP_BASE}/gopro/camera/stream/start`;
export const STREAM_STOP_URL = () => `${HTTP_BASE}/gopro/camera/stream/stop`;
