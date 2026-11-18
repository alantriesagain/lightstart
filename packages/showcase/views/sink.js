/**
 * A sink: a handful of real controls on one stage, so a skin can be judged on
 * the controls people meet first. The catalogue's hero wears one; the skins
 * page lines up one per preset.
 */
import { html, nothing } from "@lightstart/light/html";
import View, { defineComponent } from "@lightstart/light";
import containerDef from "@lightstart/components/layout/container.js";
import iconDef from "@lightstart/components/display/icon.js";
import tooltipDef from "@lightstart/components/overlay/tooltip.js";
import labelDef from "@lightstart/components/form/label.js";
import linkDef from "@lightstart/components/display/link.js";
import cardDef from "@lightstart/components/layout/card.js";
import textDef from "@lightstart/components/display/text.js";
import flexDef from "@lightstart/components/layout/flex.js";
import inputDef from "@lightstart/components/form/input.js";
import buttonDef from "@lightstart/components/display/button.js";
import badgeDef from "@lightstart/components/display/badge.js";
import tagDef from "@lightstart/components/display/tag.js";
import checkboxDef from "@lightstart/components/form/checkbox.js";
import switchDef from "@lightstart/components/form/switch.js";
import statDef from "@lightstart/components/display/stat.js";
import progressBarDef from "@lightstart/components/feedback/progress-bar.js";

View.define(containerDef);
View.define(iconDef);
View.define(tooltipDef);
View.define(labelDef);
View.define(linkDef);
View.define(cardDef);
View.define(textDef);
View.define(flexDef);
View.define(inputDef);
View.define(buttonDef);
View.define(badgeDef);
View.define(tagDef);
View.define(checkboxDef);
View.define(switchDef);
View.define(statDef);
View.define(progressBarDef);

const view = defineComponent({
  tag: "showcase-sink",
  style: true,
  props: {
    skin: "",
  },
  render() {
    return html`
      <div class="sink" data-lc-skin=${this.skin || nothing}>
        <lc-card padding="lg" class="sink-card">
          <lc-text slot="header" level="3" size="lg" weight="bold">Sign in</lc-text>
          <lc-flex direction="column" gap="sm">
            <lc-input label="Email" placeholder="you@example.com"></lc-input>
            <lc-input label="Password" type="password" value=""></lc-input>
            <lc-button primary w-full>Sign in</lc-button>
          </lc-flex>
        </lc-card>
        <lc-flex direction="column" gap="md" class="sink-side">
          <lc-flex gap="xs" wrap="wrap">
            <lc-badge variant="primary">Primary</lc-badge>
            <lc-badge variant="success">Going</lc-badge>
            <lc-tag>Free</lc-tag>
          </lc-flex>
          <lc-checkbox label="Remember me" checked></lc-checkbox>
          <lc-switch label="Notifications" checked></lc-switch>
          <lc-stat label="Attending" value="1,337"></lc-stat>
          <lc-flex gap="sm">
            <lc-button border size="sm">Cancel</lc-button>
            <lc-button primary size="sm">Confirm</lc-button>
          </lc-flex>
          <lc-progress-bar value="62"></lc-progress-bar>
        </lc-flex>
      </div>
    `;
  },
});

View.define(view);

export default view;
