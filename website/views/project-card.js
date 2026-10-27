/**
 * One project in the built-with gallery: its cover, name, description, tags
 * and author. The whole card links to the project and opens in a new tab.
 */
import { html, nothing } from "@lightstart/light/html";
import { defineComponent } from "@lightstart/light";

/** @import { Prop } from "../types.ts" */
/** @import { Project } from "../lib/built-with-light.js" */

export default defineComponent({
  tag: "docs-project-card",
  style: true,
  props: {
    project: /** @type {Prop<Project | null>} */ (/** @type {unknown} */ (null)),
    compact: false,
  },

  render() {
    const project = this.project;
    if (!project) return nothing;
    return html`
      <a
        class="project-card"
        href=${project.url}
        target="_blank"
        rel="noopener noreferrer"
        style=${`--project-accent: ${project.accent}`}
      >
        <span class="project-cover">
          ${project.image
            ? html`<img class="project-image" src=${project.image} alt="" loading="lazy" />`
            : html`
                <span class="project-icon">
                  <lc-icon name=${project.icon} size=${this.compact ? "18" : "22"}></lc-icon>
                </span>
              `}
          <span class="project-open"><lc-icon name="arrow-up-right" size="14"></lc-icon></span>
        </span>
        <span class="project-body">
          <span class="project-title">
            <b>${project.name}</b>
            ${project.status ? html`<lc-badge size="xs" soft variant="info">${project.status}</lc-badge>` : nothing}
          </span>
          <span class="project-description">${project.description}</span>
          <span class="project-tags">
            ${project.tags.map((tag) => html`<lc-tag size="xs" outlined>${tag}</lc-tag>`)}
          </span>
          ${this.compact ? nothing : html`<span class="project-author">${project.author}</span>`}
        </span>
      </a>
    `;
  },
});
