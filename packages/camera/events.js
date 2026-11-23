/**
 * `camera:frame` is one frame of the native preview while `CAMERA:FRAMES`
 * is on: `{ data, width, height, rotation }`, the JPEG as base64, its size
 * and the degrees to turn it by for the screen. It is how a phone streams
 * its native camera to another phone.
 */
export const CAMERA_FRAME = "camera:frame";
