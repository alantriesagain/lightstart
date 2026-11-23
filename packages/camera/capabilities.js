/**
 * Capability declaration for the `camera` command family (CameraX preview
 * behind the WebView). Feeds the shell-injected capability manifest and
 * mobile shell payload validation.
 */
import {
  CAMERA_BOUNDS,
  CAMERA_CAPTURE,
  CAMERA_DIAG,
  CAMERA_LENSES,
  CAMERA_FRAMES,
  CAMERA_VIEW,
  CAMERA_RECORD_START,
  CAMERA_RECORD_STOP,
  CAMERA_SET,
  CAMERA_START,
  CAMERA_STOP,
} from "./commands.js";

export default {
  id: "camera",
  description: "native camera preview, capture, and recording",
  commands: {
    [CAMERA_START]: {},
    [CAMERA_STOP]: { input: {} },
    [CAMERA_SET]: {},
    [CAMERA_BOUNDS]: {},
    [CAMERA_CAPTURE]: {},
    [CAMERA_RECORD_START]: {},
    [CAMERA_RECORD_STOP]: { input: {} },
    [CAMERA_LENSES]: { input: {} },
    [CAMERA_FRAMES]: {},
    [CAMERA_VIEW]: {},
    [CAMERA_DIAG]: { input: {} },
  },
};
