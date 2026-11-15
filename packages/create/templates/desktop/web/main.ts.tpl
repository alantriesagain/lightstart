import View from "@lightstart/light";
import { applyTheme } from "@lightstart/light/theme";
import { loadPreset } from "@lightstart/light/theme/presets.js";
import { configureIcons, iconify } from "@lightstart/light/theme/icons.js";
import titleBar from "@lightstart/components/app/title-bar.js";
import card from "@lightstart/components/layout/card.js";
import button from "@lightstart/components/display/button.js";
import text from "@lightstart/components/display/text.js";

applyTheme(await loadPreset("default"));
configureIcons({ load: iconify("lucide") });

for (const component of [titleBar, card, button, text]) View.define(component);
await import("./app.js");
