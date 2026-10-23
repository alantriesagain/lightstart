import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { expandWeek, groupWeek, isClock, pastMidnight, weekOrder } from "../utils/week-hours.js";
import { lcText } from "../utils/text.js";

/** @import { Prop, WeekHoursDay, WeekHoursEntry } from "../types.ts" */

const TAG = "lc-week-hours";
const SUNDAY = Date.UTC(2023, 0, 1);
const DAY_MS = 86400000;

/** @type {WeekHoursDay} */
const FIRST_HOURS = { open: "09:00", close: "18:00" };

/** @type {(key: string, params?: Record<string, unknown>) => string} */
const say = (key, params) => lcText(TAG, key, params);

export default defineComponent({
  tag: "lc-week-hours",
  style: true,
  props: {
    value: /** @type {Prop<WeekHoursEntry[]>} */ (T.array({ defaultValue: [] })),
    name: "",
    label: "",
    locale: "",
    firstDay: 1,
    disabled: false,
  },
  events: {
    change: T.object({ value: T.array() }),
  },
  /** @param {number} day */
  _weekday(day) {
    return new Intl.DateTimeFormat(this.locale || undefined, { weekday: "long", timeZone: "UTC" }).format(SUNDAY + day * DAY_MS);
  },
  /** @param {Array<WeekHoursDay | null>} week */
  _commit(week) {
    this.value = groupWeek(week);
    this.$emit("change", { value: this.value });
  },
  /**
   * The hours a day takes when it opens: the nearest open day before it in
   * the week, else any open day, else a working day.
   * @param {Array<WeekHoursDay | null>} week
   * @param {number} day
   * @returns {WeekHoursDay}
   */
  _hoursFor(week, day) {
    const order = weekOrder(this.firstDay);
    const at = order.indexOf(day);
    const before = order.slice(0, at).reverse().find((d) => week[d]);
    const any = order.find((d) => week[d]);
    const from = week[before ?? any ?? -1];
    return from ? { ...from } : { ...FIRST_HOURS };
  },
  /** @param {number} day @param {boolean} open */
  _toggle(day, open) {
    const week = expandWeek(this.value);
    week[day] = open ? week[day] || this._hoursFor(week, day) : null;
    this._commit(week);
  },
  /** @param {number} day @param {"open" | "close"} which @param {string} time */
  _time(day, which, time) {
    const week = expandWeek(this.value);
    const hours = week[day];
    if (!hours || !isClock(time) || hours[which] === time) return;
    week[day] = { ...hours, [which]: time };
    this._commit(week);
  },
  /** @param {number} day @param {WeekHoursDay} hours @param {string} name */
  _times(day, hours, name) {
    /** @type {(which: "open" | "close") => (e: Event) => void} */
    const edit = (which) => (e) => {
      e.stopPropagation();
      this._time(day, which, /** @type {HTMLInputElement} */ (e.target).value);
    };
    const stop = (/** @type {Event} */ e) => e.stopPropagation();
    return html`
      <span class="week-hours-times">
        <input type="time" class="week-hours-time" data-open aria-label=${say("opens", { day: name })}
          .value=${hours.open} ?disabled=${this.disabled} @input=${stop} @change=${edit("open")} />
        <span class="week-hours-to">${say("to")}</span>
        <input type="time" class="week-hours-time" data-close aria-label=${say("closes", { day: name })}
          .value=${hours.close} ?disabled=${this.disabled} @input=${stop} @change=${edit("close")} />
        ${pastMidnight(hours) ? html`<span class="week-hours-next" data-next-day>${say("nextDay")}</span>` : ""}
      </span>`;
  },
  render() {
    const week = expandWeek(this.value);
    return html`
      ${this.label ? html`<span class="week-hours-label">${this.label}</span>` : ""}
      <div class="week-hours-days" role="group" aria-label=${this.label || say("label")}>
        ${weekOrder(this.firstDay).map((day) => {
          const hours = week[day];
          const name = this._weekday(day);
          return html`
            <div class="week-hours-day${hours ? " is-open" : ""}" data-day=${day}>
              <lc-switch size="sm" label=${name} ?checked=${!!hours} ?disabled=${this.disabled}
                @change=${(/** @type {CustomEvent<{ checked: boolean }>} */ e) => { e.stopPropagation(); this._toggle(day, e.detail.checked); }}></lc-switch>
              ${hours ? this._times(day, hours, name) : html`<span class="week-hours-closed">${say("closed")}</span>`}
            </div>`;
        })}
      </div>`;
  },
});

/**
 * Week hours
 *
 * @component
 * @category form
 * @tag lc-week-hours
 *
 * Opening hours for a week: a row a day, a switch for open or closed, and the
 * hours it opens and closes. A close at or before the open runs past midnight,
 * and the row says so. `value` is a list of `{ days, open, close }`, the days
 * numbered 0 Sunday to 6 Saturday and grouped by the hours they share
 * (`utils/week-hours.js` reads and writes it); `change` carries it after each
 * edit. The week starts on `first-day` (1, Monday, by default) and the day
 * names are written in `locale`.
 *
 * @example Basic Usage
 * ```html
 * <lc-week-hours label="Opening hours"></lc-week-hours>
 * ```
 *
 * @example A bar open late
 * ```html
 * <lc-week-hours .value=${[{ days: [2, 3, 4], open: "18:00", close: "01:00" }, { days: [5, 6], open: "18:00", close: "02:00" }]}></lc-week-hours>
 * ```
 */
