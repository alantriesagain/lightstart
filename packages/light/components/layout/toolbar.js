import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-toolbar",
  style: true,
  props: {
    size: T.string({ defaultValue: "sm", enum: ["xs", "sm", "md"] }),
    variant: T.string({ defaultValue: "default", enum: ["default", "floating", "ghost"] }),
    align: T.string({ defaultValue: "start", enum: ["start", "center", "end", "between"] }),
    vertical: false,
    wrap: false,
    scrollable: false,
  },
  connected() {
    this.setAttribute("role", "toolbar");
    this.setAttribute("aria-orientation", this.vertical ? "vertical" : "horizontal");
  },
  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("vertical")) this.setAttribute("aria-orientation", this.vertical ? "vertical" : "horizontal");
  },
});

/**
 * Toolbar Component
 *
 * @component
 * @category layout
 * @tag lc-toolbar
 *
 * A row of controls that belong together: icon buttons, segmented controls,
 * inputs, separated into groups by `lc-divider vertical`. The toolbar sets
 * the height of the buttons inside it from its own `size`, so a toolbar reads
 * as one object rather than a row of mismatched controls. `floating` lifts it
 * off the surface for a toolbar over a canvas; `ghost` draws no background.
 *
 * @example Editing tools
 * ```html
 * <lc-toolbar size="sm">
 *   <lc-button icon="mouse-pointer" iconOnly selected tooltip="Select"></lc-button>
 *   <lc-button icon="type" iconOnly tooltip="Text"></lc-button>
 *   <lc-divider vertical></lc-divider>
 *   <lc-segmented .options=${["Layers", "Tracks"]}></lc-segmented>
 * </lc-toolbar>
 * ```
 *
 * @example Floating over a canvas
 * ```html
 * <lc-toolbar variant="floating" align="center">
 *   <lc-button icon="zoom-out" iconOnly></lc-button>
 *   <lc-button>Fit</lc-button>
 *   <lc-button icon="zoom-in" iconOnly></lc-button>
 * </lc-toolbar>
 * ```
 */
