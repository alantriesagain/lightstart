/**
 * Every preset on the same controls, one under the other, so the shape roles
 * a preset sets can be compared at a glance.
 */
import { html } from "@lightstart/light/html";
import { defineComponent } from "@lightstart/light";
import presets from "@lightstart/light/theme/presets.js";
import { applySkin, clearSkin } from "@bootstrapp/showcase/lib/skins.js";

export default defineComponent({
  tag: "docs-skins",
  style: true,
  props: {
    ready: false,
  },

  async connected() {
    this.$own(() => presets.forEach((preset) => clearSkin(preset.name)));
    await Promise.all(presets.map((preset) => applySkin(preset.name)));
    this.ready = true;
  },

  render() {
    return html`
      <div class="docs-page">
        <h1 class="docs-title">Skins</h1>
        <p class="docs-lede">A skin is a whole theme applied to one stage. Each preset below dresses the same sink, so what changes between them is what a theme can change.</p>
        ${presets.map(
          (preset) => html`
            <section class="skins-preset" id=${preset.name}>
              <div class="skins-head">
                <h2>${preset.label}</h2>
                <p>${preset.description}</p>
              </div>
              <showcase-sink skin=${preset.name}></showcase-sink>
            </section>
          `,
        )}
      </div>
    `;
  },
});
