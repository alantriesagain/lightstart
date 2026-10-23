import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { todayIn } from "./day-strip.js";

/** @import { MonthPickerDay, Prop } from "../types.ts" */

const DAY_MS = 86400000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^(\d{4})-(\d{2})$/;
const STEP = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/** @type {(iso: string) => number} */
const utcOf = (iso) => {
  const m = ISO.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Number.NaN;
};

/** @type {(ms: number) => string} */
const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The month a date is in, `YYYY-MM`. @type {(iso: string) => string} */
export const monthOf = (iso) => String(iso || "").slice(0, 7);

/**
 * The month `n` months on from `month`; `month` itself when it is not one.
 * @type {(month: string, n: number) => string}
 */
export const shiftMonth = (month, n) => {
  const m = MONTH.exec(month);
  if (!m) return month;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + n, 1)).toISOString().slice(0, 7);
};

/**
 * A month as whole weeks of cells, the neighbouring months' days filling the
 * first and last rows, each cell saying its number, whether it is in the
 * month, today, marked, out of bounds, an end of the pick or inside it. The
 * arithmetic runs on UTC midnights, since a calendar day is a calendar day
 * whatever the clock does.
 *
 * @param {{ month: string, locale?: string, today?: string, dots?: string[], min?: string, max?: string, weekStart?: number, from?: string, to?: string }} input
 * @returns {{ weekdays: string[], days: MonthPickerDay[] }}
 */
export const monthDays = ({ month, locale = "", today = "", dots = [], min = "", max = "", weekStart = 1, from = "", to = "" }) => {
  const m = MONTH.exec(month);
  if (!m) return { weekdays: [], days: [] };
  const first = Date.UTC(Number(m[1]), Number(m[2]) - 1, 1);
  const lead = (new Date(first).getUTCDay() - weekStart + 7) % 7;
  const start = first - lead * DAY_MS;
  const inMonth = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  const total = Math.ceil((lead + inMonth) / 7) * 7;
  const weekday = new Intl.DateTimeFormat(locale || undefined, { weekday: "narrow", timeZone: "UTC" });
  const marked = new Set(dots);
  const lo = from && to && to < from ? to : from;
  const hi = from && to && to < from ? from : to;
  return {
    weekdays: Array.from({ length: 7 }, (/** @type {unknown} */ _, i) => weekday.format(new Date(start + i * DAY_MS))),
    days: Array.from({ length: total }, (/** @type {unknown} */ _, i) => {
      const date = isoOf(start + i * DAY_MS);
      return {
        date,
        day: String(Number(date.slice(8, 10))),
        inMonth: monthOf(date) === month,
        today: date === today,
        dot: marked.has(date),
        disabled: (!!min && date < min) || (!!max && date > max),
        edge: !!lo && (date === lo || date === hi),
        inside: !!(lo && hi) && date > lo && date < hi,
      };
    }),
  };
};

export default defineComponent({
  tag: "lc-month-picker",
  style: true,
  props: {
    month: "",
    value: "",
    from: "",
    to: "",
    range: false,
    min: "",
    max: "",
    timezone: "",
    locale: "",
    weekStart: 1,
    dots: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),
    navigation: true,
    prevLabel: "Previous month",
    nextLabel: "Next month",
    disabled: false,
  },
  events: {
    change: T.object({ value: T.string(), from: T.string(), to: T.string() }),
    "month-change": T.object({ month: T.string() }),
  },
  /** @returns {string} */
  _month() {
    if (this.month) return this.month;
    return monthOf((this.range ? this.from : this.value) || todayIn(this.timezone));
  },
  /** @param {string} date */
  _pick(date) {
    if (this.disabled) return;
    if (!this.range) {
      if (date === this.value) return;
      this.value = date;
      this.$emit("change", { value: date, from: "", to: "" });
      return;
    }
    if (!this.from || this.to) {
      this.from = date;
      this.to = "";
    } else if (date < this.from) {
      this.to = this.from;
      this.from = date;
    } else this.to = date;
    this.$emit("change", { value: "", from: this.from, to: this.to });
  },
  /** @param {number} n */
  _shift(n) {
    const month = shiftMonth(this._month(), n);
    this.month = month;
    this.$emit("month-change", { month });
  },
  /** @param {KeyboardEvent} e */
  async _onKeydown(e) {
    const step = STEP[/** @type {keyof typeof STEP} */ (e.key)];
    const focused = /** @type {HTMLElement | null} */ (e.target)?.closest?.("[data-date]")?.getAttribute("data-date");
    if (step === undefined || !focused) return;
    e.preventDefault();
    const next = isoOf(utcOf(focused) + step * DAY_MS);
    if (monthOf(next) !== this._month()) this._shift(next > focused ? 1 : -1);
    await this.$requestUpdate();
    /** @type {HTMLElement | null} */ (this.querySelector(`[data-date='${next}']`))?.focus();
  },
  render() {
    const month = this._month();
    const today = todayIn(this.timezone);
    const from = this.range ? this.from : this.value;
    const { weekdays, days } = monthDays({ month, locale: this.locale, today, dots: this.dots, min: this.min, max: this.max, weekStart: this.weekStart, from, to: this.range ? this.to : "" });
    const title = new Intl.DateTimeFormat(this.locale || undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(utcOf(`${month}-01`)));
    return html`
      <div class="month-picker-head">
        ${this.navigation ? html`<button type="button" class="month-picker-nav" data-prev aria-label=${this.prevLabel} ?disabled=${this.disabled} @click=${() => this._shift(-1)}><lc-icon name="chevron-left" size="16"></lc-icon></button>` : ""}
        <span class="month-picker-title" data-month=${month}>${title}</span>
        ${this.navigation ? html`<button type="button" class="month-picker-nav" data-next aria-label=${this.nextLabel} ?disabled=${this.disabled} @click=${() => this._shift(1)}><lc-icon name="chevron-right" size="16"></lc-icon></button>` : ""}
      </div>
      <div class="month-picker-weekdays" aria-hidden="true">${weekdays.map((w) => html`<span>${w}</span>`)}</div>
      <div class="month-picker-grid" role="group" aria-disabled=${this.disabled ? "true" : "false"} @keydown=${(/** @type {KeyboardEvent} */ e) => this._onKeydown(e)}>
        ${days.map((d) => html`
          <button type="button" data-date=${d.date} aria-pressed=${d.edge ? "true" : "false"}
            class="month-picker-day${d.inMonth ? "" : " is-outside"}${d.today ? " is-today" : ""}${d.dot ? " has-dot" : ""}${d.edge ? " is-edge" : ""}${d.inside ? " is-inside" : ""}"
            tabindex=${d.edge || (!from && d.today) ? "0" : "-1"} ?disabled=${this.disabled || d.disabled}
            @click=${() => this._pick(d.date)}>
            <span class="month-picker-number">${d.day}</span>
            <span class="month-picker-dot"></span>
          </button>`)}
      </div>`;
  },
});

/**
 * Month picker
 *
 * @component
 * @category form
 * @tag lc-month-picker
 *
 * A month as a grid of days, to pick one day or a first and a last. The
 * neighbouring months fill the first and last rows so the grid stays whole;
 * today is marked, a day that carries a mark is dotted, and the picked day or
 * both ends of the range are filled with the days between them tinted. With
 * `range` the first tap is the first day, the second the last (an earlier tap
 * swaps them), and a third starts over. Days before `min` or after `max` are
 * out of reach. Dates are `YYYY-MM-DD`, the month `YYYY-MM` and defaults to
 * the picked day's or today's in `timezone`; the names are written in `locale`.
 *
 * @prop {string} month - The month shown, `YYYY-MM`.
 * @prop {string} value - The picked day, when not a range.
 * @prop {string} from - The first day of the range.
 * @prop {string} to - The last day of the range.
 * @prop {boolean} range - Pick a first and a last rather than one day.
 * @prop {string} min - The first day that can be picked.
 * @prop {string} max - The last day that can be picked.
 * @prop {string} timezone - The zone today is worked out in.
 * @prop {string} locale - The language the names are written in.
 * @prop {number} weekStart - The weekday the rows start on; Monday by default.
 * @prop {string[]} dots - The days that carry a mark.
 * @prop {boolean} navigation - The previous and next month buttons.
 * @event change - `{ value, from, to }` after a tap.
 * @event month-change - `{ month }` when the month shown moves.
 *
 * @example
 * ```html
 * <lc-month-picker range from="2026-09-26" to="2026-09-29" min="2026-09-19" timezone="America/Sao_Paulo"></lc-month-picker>
 * ```
 */
