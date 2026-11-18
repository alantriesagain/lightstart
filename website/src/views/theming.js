import { html } from "@lightstart/light/html";
import { defineComponent } from "@lightstart/light";

export default defineComponent({
  tag: "docs-theming",
  style: true,
  render() {
    return html`
      <div class="docs-page">
        <h1 class="docs-title">Theming</h1>
        <p class="docs-lede">One <code>theme.js</code> names every token a component reads. Edit them here, watch the catalogue follow, and export the file when it looks right.</p>
        <showcase-theme-generator class="theming-generator"></showcase-theme-generator>
      </div>
    `;
  },
});
