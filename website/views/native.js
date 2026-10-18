/**
 * /native: the section's introduction: what light's native build is, and the
 * section's pages in their two groups (light's native build, and the
 * background), each with what it covers. The pages are `lib/native/pages.js`.
 */
import { html } from "@bootstrapp/light/html";
import $APP from "bootstrapp";
import { defineComponent } from "@bootstrapp/light";
import navigation from "@bootstrapp/light/navigation";
import { NATIVE_GROUPS, NATIVE_PAGES, nativeNeighbours } from "../lib/native/pages.js";

/** @import { TocItem } from "@bootstrapp/light/components/types.ts" */

/** What each group of pages is for. */
const GROUP_TEXT = {
  native: "How light's native build works, how to use it, and what is not finished yet.",
  background: "How V8 and scriptc run TypeScript, starting from the concepts, with the actual output of each tool and measurements under both.",
};

/** @type {TocItem[]} */
const OUTLINE = NATIVE_GROUPS.map((group) => ({ id: group.id, label: group.label }));

export default defineComponent({
  tag: "docs-native",
  style: true,

  connected() {
    $APP.catalogue.toc = OUTLINE;
  },

  disconnected() {
    $APP.catalogue.toc = [];
  },

  render() {
    return html`
      <div class="docs-page">
        <h1 class="docs-title">Native</h1>
        <p class="docs-lede">
          Light's core can be compiled with scriptc into a native executable that runs without a JavaScript engine: as a terminal application, or as the backend of a desktop app whose UI is a light page in the system web view.
        </p>
        ${NATIVE_GROUPS.map(
          (group) => html`
            <section id=${group.id} class="native-group">
              <h2>${group.label}</h2>
              <p>${GROUP_TEXT[/** @type {keyof typeof GROUP_TEXT} */ (group.id)]}</p>
              <ul class="native-index">
                ${NATIVE_PAGES.filter((page) => page.group === group.id && page.topic).map(
                  (page) => html`
                    <li>
                      <a class="native-link" href=${navigation.href(page.href)}>${page.label}</a>
                      <span>${page.hint}</span>
                    </li>
                  `,
                )}
              </ul>
            </section>
          `,
        )}
        <lc-pagination class="docs-pager" variant="pager" .nextLink=${nativeNeighbours("").next}></lc-pagination>
      </div>
    `;
  },
});
