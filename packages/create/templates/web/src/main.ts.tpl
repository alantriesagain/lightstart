import View from "@lightstart/light";
import { applyTheme } from "@lightstart/light/theme";
import { loadPreset } from "@lightstart/light/theme/presets.js";
import { configureIcons, iconify } from "@lightstart/light/theme/icons.js";
import icon from "@lightstart/components/display/icon.js";
import link from "@lightstart/components/display/link.js";
import button from "@lightstart/components/display/button.js";
import text from "@lightstart/components/display/text.js";
import card from "@lightstart/components/layout/card.js";

applyTheme(await loadPreset("default"));
configureIcons({ load: iconify("lucide") });

for (const component of [icon, link, button, text, card]) View.define(component);
await import("./views/app-root.ts");
