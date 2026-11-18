/**
 * /built-with-light: the projects shipping on Light, one card each, and a
 * link for the next one. The projects are `lib/built-with-light.js`.
 */
import { html } from "@lightstart/light/html";
import $APP from "bootstrapp";
import { defineComponent } from "@lightstart/light";
import { PROJECTS, SUBMIT_PROJECT_URL } from "../lib/built-with-light.js";
import { COMPONENTS_PATH, GITHUB_URL } from "../lib/paths.js";

export default defineComponent({
  tag: "docs-built-with-light",
  style: true,

  connected() {
    $APP.catalogue.toc = [];
  },

  render() {
    return html`
      <div class="docs-page built-page">
        <header class="built-hero">
          <span class="built-eyebrow">Showcase</span>
          <h1 class="docs-title">Built with Light</h1>
          <p class="docs-lede">
            Apps, sites and tools that ship with the same package. Each one is made of custom elements,
            signals and the components in the catalogue.
          </p>
          <div class="built-actions">
            <lc-button primary href=${COMPONENTS_PATH}>Browse components</lc-button>
            <lc-button href=${GITHUB_URL} external><lc-icon name="github" size="15"></lc-icon>GitHub</lc-button>
          </div>
        </header>

        <section class="built-grid" aria-label="Projects built with Light">
          ${PROJECTS.map((project) => html`<docs-project-card .project=${project}></docs-project-card>`)}
        </section>

        <section class="built-submit">
          <div class="built-submit-text">
            <span class="built-eyebrow">Made something?</span>
            <h2>Add it to the list.</h2>
            <p>Send the project's name, link and a line about what it does. Anything running Light is welcome.</p>
          </div>
          <lc-button primary href=${SUBMIT_PROJECT_URL} external>Submit a project</lc-button>
        </section>
      </div>
    `;
  },
});
