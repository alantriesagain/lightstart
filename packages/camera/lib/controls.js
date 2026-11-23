/**
 * The control registry: the single source for both the UI widget and the lesson.
 *
 * Each entry describes one adjustable thing on a camera. `hardwareKey` is the
 * MediaTrackConstraint we try to drive on real hardware; `simulate: true` marks a
 * control that phone hardware can never set (aperture is fixed), so it is always
 * taught with an illustrative preview; `simulatable: true` marks a control that is
 * real where the device exposes it and falls back to a simulated lesson otherwise.
 * Whether a given device actually supports a control is resolved at runtime against
 * getCapabilities(), not baked in here.
 */

/** @import { CameraControl } from "../types.ts" */

/** @type {CameraControl[]} */
export const CONTROLS = [
  {
    id: "zoom",
    label: "Zoom / focal length",
    unit: "×",
    group: "framing",
    hardwareKey: "zoom",
    explain: {
      what: "How much the lens magnifies. 1× is the main lens, higher numbers crop in tighter.",
      why: "Zoom changes your field of view and your perspective. The mm reading is the real language: around 24mm is wide, 50mm looks natural, 85mm and up flatters faces.",
      when: "Go wide (low mm) for landscapes, interiors, and vlogging close to your face. Go long (high mm) for portraits, wildlife, and compressing a busy background.",
    },
  },
  {
    id: "exposure",
    label: "Exposure compensation",
    unit: "EV",
    group: "light",
    hardwareKey: "exposureCompensation",
    explain: {
      what: "Nudges the whole image brighter or darker.",
      why: "The camera aims for an average mid grey, so snow comes out too dark and spotlights too bright. Exposure compensation corrects that.",
      when: "Push positive for bright or backlit scenes and snow. Pull negative to protect a sunset or keep a moody, darker look.",
    },
  },
  {
    id: "iso",
    label: "ISO",
    unit: "",
    group: "light",
    hardwareKey: "iso",
    simulatable: true,
    explain: {
      what: "How sensitive the sensor is to light.",
      why: "Low ISO stays clean. High ISO brightens dark scenes but adds grain and noise.",
      when: "Keep ISO low (100 to 400) in daylight. Raise it indoors or at night, trading some noise to avoid motion blur.",
    },
  },
  {
    id: "shutter",
    label: "Shutter speed",
    unit: "s",
    group: "light",
    hardwareKey: "exposureTime",
    simulatable: true,
    explain: {
      what: "How long the sensor collects light for each frame.",
      why: "Fast shutter freezes motion. Slow shutter blurs it and gathers more light.",
      when: "Fast (1/1000) for sports and splashing water. Slow (1/15 or longer, on something steady) for silky waterfalls and light trails.",
    },
  },
  {
    id: "aperture",
    label: "Aperture",
    unit: "f/",
    group: "light",
    simulate: true,
    explain: {
      what: "The size of the lens opening, written like f/1.8 or f/8.",
      why: "Wide (f/1.8) blurs the background and lets in more light. Narrow (f/8 and up) keeps more of the scene sharp.",
      when: "Wide for portraits and low light, narrow for landscapes where everything should be sharp. On phones the aperture is fixed in hardware, so this teaches the idea. A real camera, or the installed app on supported devices, lets you set it.",
    },
  },
  {
    id: "whiteBalance",
    label: "White balance",
    unit: "K",
    group: "color",
    hardwareKey: "colorTemperature",
    simulatable: true,
    explain: {
      what: "Tells the camera what white looks like under the current light.",
      why: "Light has color: candles are warm and orange, shade is cool and blue. White balance removes the cast, or you can leave it for mood.",
      when: "Auto is fine most of the time. Set it warm to keep a golden sunset, cool to fix an orange indoor cast.",
    },
  },
  {
    id: "focus",
    label: "Focus distance",
    unit: "",
    group: "focus",
    hardwareKey: "focusDistance",
    simulatable: true,
    explain: {
      what: "Where the lens is sharp.",
      why: "Autofocus guesses your subject. Manual focus locks it so it cannot hunt at the wrong moment.",
      when: "Use manual focus for video focus pulls, macro, and shooting through glass or fences where autofocus gets confused.",
    },
  },
  {
    id: "torch",
    label: "Torch",
    unit: "",
    group: "light",
    toggle: true,
    hardwareKey: "torch",
    explain: {
      what: "The LED light kept on continuously.",
      why: "It adds light in the dark, but it is hard and flat from close up.",
      when: "Handy as a fill in a pinch. For nicer results, bounce or diffuse it instead of pointing it straight on.",
    },
  },
];

/**
 * @param {string} id
 * @returns {CameraControl | null}
 */
export const controlById = (id) => CONTROLS.find((c) => c.id === id) || null;
