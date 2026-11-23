/**
 * `@lightstart/camera` cross-runtime command types: the UPPER `CAMERA:ACTION`
 * message names spoken over the mobile shell bridge (CameraX preview behind the
 * WebView). The generated native `Commands.kt` mirrors these values.
 */
export const CAMERA_BOUNDS = "CAMERA:BOUNDS";
export const CAMERA_CAPTURE = "CAMERA:CAPTURE";
export const CAMERA_DIAG = "CAMERA:DIAG";
export const CAMERA_LENSES = "CAMERA:LENSES";
/** `{ on, width, fps }`: the preview's frames to the page as `camera:frame` events, JPEG at that width and rate, for a page that sends the picture on. */
export const CAMERA_FRAMES = "CAMERA:FRAMES";
/** `{ scale }`: the native preview magnified on the screen, 1 to 4, the camera untouched. */
export const CAMERA_VIEW = "CAMERA:VIEW";
export const CAMERA_RECORD_START = "CAMERA:RECORD_START";
export const CAMERA_RECORD_STOP = "CAMERA:RECORD_STOP";
export const CAMERA_SET = "CAMERA:SET";
export const CAMERA_START = "CAMERA:START";
export const CAMERA_STOP = "CAMERA:STOP";
