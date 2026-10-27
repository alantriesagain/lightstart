import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { dayKeyOf, dayWords, groupByDay, readAt, timeWords } from "../utils/day-groups.js";
/** @import { Prop, TimelineEntry, TimelineExtra } from "../types.ts" */

const EXTERNAL = /^[a-z][a-z\d+.-]*:/i;

/**
 * @param {TimelineEntry} entry
 * @param {string} locale
 * @param {TimelineExtra | null} extra
 */
const entryOf = (entry, locale, extra) => {
  const moment = readAt(entry.at);
  return html`
    <li class="timeline-entry" part="lc-timeline-entry" data-variant=${entry.variant || "default"}>
      <span class="timeline-marker" part="lc-timeline-marker">${entry.icon ? html`<lc-icon name=${entry.icon}></lc-icon>` : nothing}</span>
      <div class="timeline-main" part="lc-timeline-main">
        ${moment.kind === "instant"
          ? html`<time class="timeline-time" part="lc-timeline-time" datetime=${entry.at}>${timeWords(moment.ms, locale)}</time>`
          : nothing}
        ${entry.title
          ? entry.href
            ? html`<lc-link
                class="timeline-title"
                part="lc-timeline-title"
                href=${entry.href}
                label=${entry.title}
                ?external=${EXTERNAL.test(entry.href)}
              ></lc-link>`
            : html`<span class="timeline-title" part="lc-timeline-title">${entry.title}</span>`
          : nothing}
        ${entry.body ? html`<p class="timeline-body" part="lc-timeline-body">${entry.body}</p>` : nothing}
        ${extra ? html`<div class="timeline-extra" part="lc-timeline-extra">${extra(entry)}</div>` : nothing}
      </div>
    </li>
  `;
};

export default defineComponent({
  tag: "lc-timeline",
  style: true,
  props: {
    entries: /** @type {Prop<TimelineEntry[]>} */ (T.array({ defaultValue: [] })),
    oldestFirst: T.boolean(),
    extra: /** @type {Prop<TimelineExtra | null>} */ (T.function({ defaultValue: null })),
  },
  render() {
    if (!this.entries.length) return nothing;
    const locale = document.documentElement.lang || "en";
    const today = dayKeyOf(Date.now());
    return groupByDay(this.entries, { oldestFirst: this.oldestFirst }).map(
      ({ day, entries }) => html`
        <section class="timeline-day" part="lc-timeline-day" data-day=${day ?? nothing}>
          ${day
            ? html`<h2 class="timeline-day-title" part="lc-timeline-day-title"><time datetime=${day}>${dayWords(day, locale, today)}</time></h2>`
            : nothing}
          <ol class="timeline-list" part="lc-timeline-list">
            ${entries.map((entry) => entryOf(entry, locale, this.extra))}
          </ol>
        </section>
      `,
    );
  },
});
