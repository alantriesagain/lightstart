/**
 * The lesson, computed from the settings that made a frame: which stop paid
 * for which, what that did in the picture, and the same for a clip against
 * its frame rate. Pure sentences, no voice.
 */
import { BASE_ISO, formatAperture, formatIso, formatShutter, sayStops, stopsBetween } from "./stops.js";

/**
 * @typedef {{ mode?: string, shutter?: number, aperture?: number, iso?: number | "auto", ev?: number, lens?: number, fps?: number, resolution?: string, fixedAperture?: boolean, metered?: { shutter?: number, aperture?: number, iso?: number } }} Settings
 */

/** @param {number | undefined} iso */
const grain = (iso) => {
  if (typeof iso !== "number") return "";
  const over = stopsBetween("iso", BASE_ISO, iso);
  if (over < 0.5) return `ISO ${iso} is base: no grain to speak of.`;
  if (over < 2.5) return `ISO ${iso} is ${sayStops(over)} over base: a little grain in the shadows.`;
  if (over < 4.5) return `ISO ${iso} is ${sayStops(over)} over base: grain in the flat tones.`;
  return `ISO ${iso} is ${sayStops(over)} over base: grain everywhere, and flatter colour.`;
};

/** @param {number | undefined} shutter @param {number | undefined} lens */
const steadiness = (shutter, lens) => {
  if (!(typeof shutter === "number" && shutter > 0)) return "";
  const limit = 1 / (lens || 26);
  if (shutter <= limit / 4) return `${formatShutter(shutter)} freezes motion.`;
  if (shutter <= limit) return `${formatShutter(shutter)} holds by hand at ${lens || 26}mm.`;
  if (shutter <= 0.5) return `${formatShutter(shutter)} is slower than the hand holds at ${lens || 26}mm: braced, or it blurs.`;
  return `${formatShutter(shutter)} needs a wall or a tripod; anything that moves streaks.`;
};

/**
 * A photo's lesson: a headline that names who set what, and one line per
 * thing the settings did in this frame.
 * @param {Settings} s
 * @returns {{ headline: string, lines: string[] }}
 */
export const explainExposure = (s) => {
  const sh = typeof s.shutter === "number" ? formatShutter(s.shutter) : "";
  const ap = typeof s.aperture === "number" ? formatAperture(s.aperture) : "";
  const iso = typeof s.iso === "number" ? s.iso : undefined;
  const mode = s.mode || "auto";
  const lines = [steadiness(s.shutter, s.lens), grain(iso)].filter(Boolean);
  let headline = "";
  if (mode === "m") headline = `You set ${[sh, ap].filter(Boolean).join(" and ")}${iso ? `, so ISO ${iso} is what the light asked for` : ""}.`;
  else if (mode === "tv") headline = `You set ${sh}. The camera answered with ${[ap, iso ? `ISO ${iso}` : ""].filter(Boolean).join(" and ")}.`;
  else if (mode === "av") headline = s.fixedAperture
    ? `You set ${ap}, which this lens is fixed at, so the camera chose ${[sh, iso ? `ISO ${iso}` : ""].filter(Boolean).join(" and ")}.`
    : `You set ${ap}. The camera answered with ${[sh, iso ? `ISO ${iso}` : ""].filter(Boolean).join(" and ")}.`;
  else if (mode === "p") headline = `The camera chose ${[sh, ap, iso ? `ISO ${iso}` : ""].filter(Boolean).join(", ")}${typeof s.ev === "number" && s.ev !== 0 ? `, ${s.ev > 0 ? "lifted" : "held down"} ${sayStops(s.ev)} by you` : ""}.`;
  else headline = `The camera chose everything: ${[sh, ap, iso ? `ISO ${iso}` : ""].filter(Boolean).join(", ")}.`;
  if (mode === "m" && typeof s.shutter === "number" && iso && iso > BASE_ISO * 2) {
    const halfIso = iso / 2;
    lines.push(`At ISO ${Math.round(halfIso)} the same frame would have needed ${formatShutter(s.shutter * 2)}.`);
  }
  if (mode === "tv" && s.metered?.shutter && typeof s.shutter === "number" && iso) {
    const faster = stopsBetween("shutter", s.shutter, s.metered.shutter);
    if (faster > 0.4) lines.push(`${sh} is ${sayStops(faster)} faster than the light wanted, so ISO rose by the same ${sayStops(faster)}.`);
  }
  return { headline, lines };
};

/**
 * A clip's lesson: the shutter against the frame rate, as the angle a film
 * camera's shutter would have.
 * @param {Settings} s
 * @returns {{ headline: string, lines: string[] }}
 */
export const explainVideo = (s) => {
  const fps = s.fps || 30;
  const lines = [];
  let headline = `${s.resolution || "1080p"} at ${fps} frames a second.`;
  if (typeof s.shutter === "number" && s.shutter > 0) {
    const angle = Math.round(360 * s.shutter * fps);
    const sh = formatShutter(s.shutter);
    if (angle >= 150 && angle <= 210) headline = `${sh} at ${fps} frames is the 180° rule: each frame holds half its time, so motion blurs the way the eye sees it.`;
    else if (angle < 150) headline = `${sh} at ${fps} frames is a ${angle}° shutter: each frame holds ${angle < 60 ? "a sliver" : "less than half"} of its time, so motion stutters.`;
    else headline = `${sh} at ${fps} frames is a ${Math.min(angle, 360)}° shutter: each frame holds ${angle >= 350 ? "all" : "most"} of its time, so motion smears.`;
    lines.push(`For the 180° look at ${fps} frames the shutter is 1/${fps * 2}.`);
  }
  if (typeof s.iso === "number") lines.push(grain(s.iso));
  return { headline, lines: lines.filter(Boolean) };
};

/**
 * The lesson for one media row's settings, photo or clip.
 * @param {"photo" | "video"} kind
 * @param {Settings} settings
 */
export const explain = (kind, settings) => (kind === "video" ? explainVideo(settings) : explainExposure(settings));

/** @param {Settings} s */
export const shotLine = (s) => [s.mode ? { auto: "A+", p: "P", av: "Av", tv: "Tv", m: "M", b: "B" }[s.mode] : "", typeof s.shutter === "number" ? formatShutter(s.shutter) : "", typeof s.aperture === "number" ? formatAperture(s.aperture) : "", s.iso != null ? `ISO ${formatIso(s.iso)}` : "", typeof s.lens === "number" ? `${s.lens}mm` : ""].filter(Boolean);
