/**
 * The DOM `<maps-view>` draws over its canvas: pins, clusters, the reader's
 * dot and route marks. Each is a template the view renders into a pane it
 * owns; where each one sits is written per frame by the view, never here.
 */
import { html, nothing } from "@lightstart/light/html";
import { DROP_PATH, FOLD_PATH, PHOTO_SIZE, pinIcon } from "../../lib/pins.js";

/** @import { MapPoint } from "../../types.ts" */
/** @import { TemplateValue } from "@lightstart/light/html" */

/**
 * @param {string} name
 * @param {string | undefined} value
 */
const customProperty = (name, value) => (value ? `${name}:${value}` : nothing);

/**
 * Custom properties from the ones a point sets, as one style value, or
 * nothing when it sets none.
 * @param {Array<[string, string | number | undefined]>} pairs
 */
const customProperties = (pairs) => {
  const set = pairs.filter(([, value]) => value !== undefined && value !== "");
  return set.length ? set.map(([name, value]) => `${name}:${value}`).join(";") : nothing;
};

/** @param {MapPoint} pt */
const sizeOf = (pt) => customProperties([["--maps-pin-photo-size", pt.size ? `${pt.size}px` : undefined]]);

/** @param {{ src?: string, name?: string }} face */
const faceMark = (face) => (face.src
  ? html`<img class="maps-view-pin-face" src=${face.src} alt=${face.name || ""} loading="lazy" decoding="async" />`
  : html`<span class="maps-view-pin-face">${String(face.name || "").trim().charAt(0).toUpperCase()}</span>`);

/**
 * What rides on a pin beside its picture: a coloured dot, the today mark, a
 * short text under it (the hour), a caption under it (a name, with a bold
 * lead), a count at its shoulder, up to three faces under it (or at its foot
 * on the start side, `facesAt: "start"`, when a caption takes the middle),
 * and a glyph at its shoulder where there is no count, in its own colours
 * when the point gives them.
 * @param {MapPoint} pt
 */
export const pinMarks = (pt) => html`${pt.badgeColor ? html`<span class="maps-view-pin-badge" style=${customProperty("--maps-pin-badge-background", pt.badgeColor)}></span>` : nothing}${pt.today ? html`<span class="maps-view-pin-today"></span>` : nothing}${pt.count ? html`<span class="maps-view-pin-count">${pt.count}</span>` : nothing}${pt.badgeText ? html`<span class="maps-view-pin-text">${pt.badgeText}</span>` : nothing}${pt.caption ? html`<span class="maps-view-pin-caption">${pt.captionLead ? html`<b>${pt.captionLead}</b> · ` : nothing}${pt.caption}</span>` : nothing}${pt.faces?.length ? html`<span class="maps-view-pin-faces${pt.facesAt === "start" ? " is-start" : ""}">${pt.faces.slice(0, 3).map(faceMark)}</span>` : nothing}${pt.glyph && !pt.count ? html`<span class="maps-view-pin-glyph" style=${customProperties([["--maps-pin-glyph-background", pt.glyphBackground], ["--maps-pin-glyph-color", pt.glyphColor]])}><lc-icon name=${pt.glyph} size="11"></lc-icon></span>` : nothing}`;

/**
 * A point as a drop in its colour, the point's icon on its head.
 * @param {MapPoint} pt
 * @param {{ color: string, active: boolean, onClick: (e: MouseEvent) => void }} options
 */
export const dropPin = (pt, { color, active, onClick }) => html`<button type="button" class="maps-view-pin maps-view-pin-drop${active ? " is-active" : ""}" style=${customProperty("--maps-pin-color", color)} aria-label=${pt.name || "Map pin"} @click=${onClick}><span class="maps-view-pin-ground"></span><svg class="maps-view-pin-svg" viewBox="0 0 36 43" width="36" height="43" aria-hidden="true"><path class="maps-view-pin-lift" d=${DROP_PATH} transform="translate(0 1.5)"></path><path class="maps-view-pin-body" d=${DROP_PATH}></path><path class="maps-view-pin-fold" d=${FOLD_PATH}></path><path class="maps-view-pin-edge" d=${DROP_PATH}></path></svg><lc-icon class="maps-view-pin-icon" name=${pinIcon(pt.icon)} size="20"></lc-icon>${pinMarks(pt)}</button>`;

/**
 * A point with a thumbnail, drawn round; the play glyph only where the point
 * says it plays.
 * @param {MapPoint} pt
 * @param {{ active: boolean, onClick: (e: MouseEvent) => void, onError: () => void }} options
 */
export const photoPin = (pt, { active, onClick, onError }) => html`<button type="button" class="maps-view-pin maps-view-pin-photo${active ? " is-active" : ""}" style=${sizeOf(pt)} aria-label=${pt.name || "Map pin"} @click=${onClick}><img src=${pt.thumb} alt="" width=${PHOTO_SIZE} height=${PHOTO_SIZE} loading="lazy" decoding="async" fetchpriority="low" @error=${onError} />${pt.play ? html`<span class="maps-view-pin-play">▶</span>` : nothing}${pinMarks(pt)}</button>`;

/**
 * A point with letters where its picture would be: somebody with no photo,
 * drawn the size and shape a photo pin is.
 * @param {MapPoint} pt
 * @param {{ active: boolean, onClick: (e: MouseEvent) => void }} options
 */
export const initialsPin = (pt, { active, onClick }) => html`<button type="button" class="maps-view-pin maps-view-pin-photo maps-view-pin-initials${active ? " is-active" : ""}" style=${sizeOf(pt)} aria-label=${pt.name || "Map pin"} @click=${onClick}><span class="maps-view-pin-initials-text">${pt.initials}</span>${pinMarks(pt)}</button>`;

/**
 * Many points as one: the count, ringed with their colours.
 * @param {number} count
 * @param {{ ring: string, onClick: (e: MouseEvent) => void }} options
 */
export const clusterPin = (count, { ring, onClick }) => html`<button type="button" class="maps-view-pin maps-view-cluster" style=${customProperty("--maps-cluster-ring-background", ring)} aria-label=${`${count} places`} @click=${onClick}><span class="maps-view-cluster-ring"></span><span class="maps-view-cluster-count">${count}</span></button>`;

/** The reader's position: a dot, a pulse, and a ring as wide as the fix is uncertain. */
export const userMarker = () => html`<div class="maps-view-user" hidden><div class="maps-view-user-ring" hidden></div><div class="maps-view-user-pulse"></div><div class="maps-view-user-dot"></div></div>`;

/**
 * The line through a route's stops; the view writes its points per frame.
 * @param {string} color
 * @param {boolean} hidden
 */
export const routeLine = (color, hidden) => html`<svg class="maps-view-route-line" style=${customProperty("--maps-route-color", color)} ?hidden=${hidden}><polyline></polyline></svg>`;

/**
 * A route's stops, numbered by their label or their order.
 * @param {MapPoint[]} stops
 * @param {string | undefined} color
 */
export const routeMarks = (stops, color) => html`<div class="maps-view-route-marks" style=${customProperty("--maps-route-color", color)}>${stops.map((s, i) => html`<div class="maps-view-route-mark">${s.label ?? i + 1}</div>`)}</div>`;

/**
 * The popup's content with its close control.
 * @param {TemplateValue} content
 * @param {() => void} onClose
 */
export const popupFrame = (content, onClose) => html`${content}<lc-button ghost iconOnly size="xs" class="maps-view-popup-close" aria-label="Close" @click=${onClose}><lc-icon name="x" size="14"></lc-icon></lc-button>`;
