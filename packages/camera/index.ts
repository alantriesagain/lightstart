/**
 * @file @lightstart/camera: a hardware-abstracted camera (web getUserMedia in
 * browsers, CameraX through the light mobile shell on phones), the learning
 * control registry, lens/EXIF helpers, the `<camera-preview>` surface, and a
 * second phone as the camera over a peer room.
 */

export {
  classifyLens,
  controlById,
  controls,
  createCamera,
  describeZoom,
  effectiveMm,
  focalLengthHint,
  isNativeShell,
  isSupported,
  lensChipLabel,
  lensFromMm,
} from "./camera.js";
export { hasNativeCamera, selectBackend } from "./select-backend.js";

export { CONTROLS } from "./lib/controls.js";
export { LENS_TYPES } from "./lib/lens-model.js";

export {
  APERTURE_THIRDS,
  BASE_ISO,
  EV_THIRDS,
  ISO_THIRDS,
  SHUTTER_THIRDS,
  clipStops,
  formatAperture,
  formatEv,
  formatIso,
  formatShutter,
  nearestStop,
  sayStops,
  stopsBetween,
} from "./lib/stops.js";
export {
  BODIES,
  MODE_ORDER,
  controlLabel,
  modeAside,
  modeLabel,
  modeLine,
  modeName,
  placement,
} from "./lib/bodies.js";
export { CELLS, availability, settable } from "./lib/exposure-modes.js";
export { explain, explainExposure, explainVideo, shotLine } from "./lib/explain.js";
export { parseExif, readExifTags } from "./lib/exif.js";
export { createSounds } from "./lib/sound.js";
export { PAIR_TTL_MS, PAIR_VERSION, decodePair, encodePair, isFresh } from "./lib/pair.js";
export { serveCamera, viewCamera, PHOTO_SIZES, REMOTE_ACTIONS } from "./remote.js";
export { cameraFrame, cameraMeter, cameraOrientation, installCameraSignals } from "./signals.js";

export type {
  CameraBackend,
  CameraCapabilities,
  CameraControl,
  CameraExif,
  CameraInstance,
  CameraLinkSlot,
  CameraModule,
  CameraPair,
  CameraSettings,
  CameraSounds,
  CameraStartOptions,
  CapabilityRange,
  ControlExplain,
  ControlKey,
  ControlRange,
  DevicesSlot,
  EnrichedLens,
  Facing,
  KeepFormat,
  LensDevice,
  LensInfo,
  PendingCapture,
  PhotoResult,
  PhotoSize,
  Prop,
  RecordingOptions,
  RecordingResult,
  RemoteCamera,
  RemoteCaps,
  RemoteClip,
  RemotePhoto,
  RemoteRoom,
  RemoteState,
  RemoteViewer,
  ResolvedControl,
  StartResult,
  Unsubscribe,
  ZoomDescription,
} from "./types.ts";
