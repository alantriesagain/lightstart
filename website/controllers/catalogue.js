import $APP from "bootstrapp";
import { defineController } from "@bootstrapp/light/controller";
import presets, { loadPreset } from "@bootstrapp/light/theme/presets.js";
import { componentPath } from "../lib/paths.js";

/** @import { SkinOption } from "../types.ts" */
/** @import { SearchDoc, TocItem } from "@bootstrapp/light/components/types.ts" */

const HOST_THEME = "";

/**
 * @param {Record<string, unknown> | null} theme
 * @param {string} group
 * @param {string} key
 */
const token = (theme, group, key) => {
  const block = /** @type {Record<string, unknown> | undefined} */ (theme?.[group]);
  const value = block?.[key];
  return typeof value === "string" ? value : "";
};

export default defineController({
  name: "catalogue",
  props: {
    skin: /** @type {string} */ (HOST_THEME),
    search: "",
    toc: /** @type {TocItem[]} */ ([]),
    skins: /** @type {SkinOption[]} */ ([]),
  },
  sync: { skin: { to: "local", key: "lc:skin" } },

  async connected() {
    const fromQuery = new URLSearchParams(location.search).get("skin");
    if (fromQuery !== null) this.skin = fromQuery;
    this.skins = await Promise.all(
      presets.map(async (preset) => {
        const theme = await loadPreset(preset.name);
        return {
          name: preset.name,
          label: preset.label,
          description: preset.description,
          primary: token(theme, "color", "primary"),
          canvas: token(theme, "canvas", "background") || token(theme, "color", "surface"),
        };
      }),
    );
  },

  skinLabel() {
    return this.skins.find((skin) => skin.name === this.skin)?.label ?? "Default";
  },

  /** @param {string} name */
  chooseSkin(name) {
    this.skin = name === "default" ? HOST_THEME : name;
  },

  /**
   * @param {string} category
   * @param {string} name
   */
  open(category, name) {
    $APP.Router.go(componentPath(category, name));
  },

  /** @param {SearchDoc} doc */
  select(doc) {
    if (doc.kind === "skin") return this.chooseSkin(String(doc.skin));
    if (doc.href) $APP.Router.go(doc.href);
  },
});
