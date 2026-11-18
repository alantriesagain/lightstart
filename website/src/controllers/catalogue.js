import { defineController, registerAdapter } from "@lightstart/light/controller";
import { localStorage, memoryStorage } from "@lightstart/light/controller/storage";
import { navigate } from "@lightstart/app/web";
import app from "../app.ts";
import presets, { loadPreset } from "@lightstart/light/theme/presets.js";
import { componentPath } from "../../lib/paths.js";

/** @import { SkinOption } from "../../types.ts" */
/** @import { SearchDoc, TocItem } from "@lightstart/components/types.ts" */

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

registerAdapter("local", typeof window === "undefined" ? memoryStorage : localStorage);

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
    const fromQuery = app.args.string("skin");
    if (fromQuery !== undefined) this.skin = fromQuery;
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
    navigate(componentPath(category, name));
  },

  /** @param {SearchDoc} doc */
  select(doc) {
    if (doc.kind === "skin") return this.chooseSkin(String(doc.skin));
    if (doc.href) navigate(doc.href);
  },
});
