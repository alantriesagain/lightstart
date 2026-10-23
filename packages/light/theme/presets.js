/**
 * The theme presets light ships, in the order a picker should offer them. A
 * preset covers the whole token contract, so applying one is never a partial
 * restyle.
 */

/** @import { ThemePreset } from "./types.ts" */

/** @type {ThemePreset[]} */
const presets = [
  {
    name: "default",
    label: "Default",
    description: "The framework's own look: ink and one signal colour on cool grey, hairline edges, the platform's type",
    loader: () => import("./themes/default.js"),
  },
  {
    name: "neobrutalist",
    label: "Neobrutalist",
    description: "Thick black borders, hard offset shadows, uppercase controls",
    loader: () => import("./themes/neobrutalist.js"),
  },
  {
    name: "daisy",
    label: "Daisy",
    description: "Pill selectors, a soft depth under buttons, base surfaces in three steps",
    loader: () => import("./themes/daisy.js"),
  },
  {
    name: "gruvbox-dark",
    label: "Gruvbox Dark",
    description: "Warm retro groove palette on a dark canvas",
    loader: () => import("./themes/gruvbox-dark.js"),
  },
  {
    name: "gruvbox-light",
    label: "Gruvbox Light",
    description: "Warm retro groove palette on a cream canvas",
    loader: () => import("./themes/gruvbox-light.js"),
  },
];

export default presets;

/** @param {string} name */
export const presetByName = (name) => presets.find((preset) => preset.name === name) ?? null;

/**
 * The preset's theme object, or null when no preset carries that name.
 * @param {string} name
 * @returns {Promise<Record<string, unknown> | null>}
 */
export const loadPreset = async (name) => {
  const preset = presetByName(name);
  if (!preset) return null;
  const module = await preset.loader();
  return module.default ?? module;
};
