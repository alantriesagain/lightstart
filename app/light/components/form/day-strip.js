import { html } from "/app/light/html/index.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
import { nextIndex } from "../utils/roving.js";

/** @import { DayStripDay, Prop } from "../types.js" */

const DAY_MS = 86400000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** @type {(iso: string) => number} */
const utcOf = (iso) => {
  const m = ISO.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Number.NaN;
};

/** @type {(ms: number) => string} */
const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * The calendar date it is now where the reader is, or in the zone asked for.
 * @type {(timezone: string, now?: number) => string}
 */
export const todayIn = (timezone, now = Date.now()) => {
  const parts = new Intl.DateTimeFormat("en-CA", { ...(timezone ? { timeZone: timezone } : {}), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now));
  const get = (/** @type {string} */ type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

/**
 * The days a strip draws: `days` of them from `from`, each with the weekday
 * the locale writes it, its number, whether it is today and whether it has a
 * mark. The arithmetic runs on UTC midnights, since a calendar day is a
 * calendar day whatever the clock does.
 *
 * @param {{ from: string, days: number, locale?: string, today?: string, dots?: string[] }} input
 * @returns {DayStripDay[]}
 */
export const stripDays = ({ from, days, locale = "", today = "", dots = [] }) => {
  const start = utcOf(from);
  if (Number.isNaN(start)) return [];
  const weekday = new Intl.DateTimeFormat(locale || undefined, { weekday: "short", timeZone: "UTC" });
  const marked = new Set(dots);
  return Array.from({ length: Math.max(0, days) }, (/** @type {unknown} */ _, i) => {
    const ms = start + i * DAY_MS;
    const date = isoOf(ms);
    return { date, weekday: weekday.format(new Date(ms)).replace(/\.$/, ""), day: String(Number(date.slice(8, 10))), today: date === today, dot: marked.has(date) };
  });
};

export default defineComponent({
  tag: "lc-day-strip",
  style: true,
  props: {
    value: "",
    from: "",
    days: 7,
    timezone: "",
    locale: "",
    dots: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),
    disabled: false,
  },
  events: {
    change: T.object({ value: T.string() }),
  },
  /** @returns {DayStripDay[]} */
  _days() {
    const today = todayIn(this.timezone);
    return stripDays({ from: this.from || today, days: this.days, locale: this.locale, today, dots: this.dots });
  },
  /** @param {string} date */
  _pick(date) {
    if (this.disabled || date === this.value) return;
    this.value = date;
    this.$emit("change", { value: date });
  },
  /** @param {KeyboardEvent} e @param {DayStripDay[]} days */
  _onKeydown(e, days) {
    const current = days.findIndex((d) => d.date === this.value);
    const next = nextIndex(e.key, current, days.length, { orientation: "horizontal", homeEnd: true });
    if (next === null) return;
    e.preventDefault();
    this._pick(days[next].date);
    /** @type {HTMLElement | null} */ (this.querySelectorAll(".day-strip-day")[next])?.focus();
  },
  render() {
    const days = this._days();
    return html`
      <div class="day-strip-track" role="radiogroup" aria-disabled=${this.disabled ? "true" : "false"}
        @keydown=${(/** @type {KeyboardEvent} */ e) => this._onKeydown(e, days)}>
        ${days.map((d) => {
          const on = d.date === this.value;
          return html`
            <button type="button" role="radio" aria-checked=${on ? "true" : "false"} data-date=${d.date}
              class="day-strip-day${on ? " is-selected" : ""}${d.today ? " is-today" : ""}${d.dot ? " has-dot" : ""}"
              tabindex=${on || (!this.value && d.today) ? "0" : "-1"}
              ?disabled=${this.disabled}
              @click=${() => this._pick(d.date)}>
              <span class="day-strip-weekday">${d.weekday}</span>
              <span class="day-strip-number">${d.day}</span>
              <span class="day-strip-dot"></span>
            </button>`;
        })}
      </div>`;
  },
});

/**
 * Day strip
 *
 * @component
 * @category form
 * @tag lc-day-strip
 *
 * A week of days as one row of radios, so any day is one tap: the weekday
 * over the number, the selected one filled, today marked, and a dot under a
 * day that has something on it. `value` and `from` are `YYYY-MM-DD`; `from`
 * defaults to today in `timezone` (the reader's zone when empty), and the
 * weekday is written in `locale`.
 *
 * @prop {string} value - The selected day.
 * @prop {string} from - The first day drawn; today by default.
 * @prop {number} days - How many days; seven by default.
 * @prop {string} timezone - The zone today is worked out in.
 * @prop {string} locale - The language the weekday is written in.
 * @prop {string[]} dots - The days that carry a mark.
 * @event change - `{ value }` when a day is picked.
 *
 * @example
 * ```html
 * <lc-day-strip value="2026-09-27" from="2026-09-27" timezone="America/Sao_Paulo" .dots=${["2026-09-27", "2026-09-29"]}></lc-day-strip>
 * ```
 */
