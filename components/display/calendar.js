import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

/** @import { CalendarDay, CalendarDayDrop, CalendarEvent, CalendarEventRenderer, Prop, RecurrencePattern } from "../types.ts" */

/**
 * @param {CalendarEvent} event
 * @param {Date} startDate
 * @param {Date} endDate
 */
const generateRecurringInstances = (event, startDate, endDate) => {
  if (!event.isRecurring) return [];
  const instances = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  const recurrenceEnd = event.recurrenceEndDate
    ? new Date(event.recurrenceEndDate)
    : new Date(current.getTime() + 31536000000);
  const originalDate = new Date(event.date);

  /**
   * @param {Date} date
   * @param {CalendarEvent} evt
   * @param {Date} origDate
   */
  const shouldGenerate = (date, evt, origDate) => {
    switch (evt.recurrencePattern) {
      case "daily":
        return true;
      case "weekly":
        return date.getDay() === origDate.getDay();
      case "monthly":
        return date.getDate() === origDate.getDate();
      case "custom":
        return evt.recurrenceDays?.includes(date.getDay());
      default:
        return false;
    }
  };

  /**
   * @param {Date} date
   * @param {RecurrencePattern} [pattern]
   */
  const advance = (date, pattern) => {
    switch (pattern) {
      case "daily":
        date.setDate(date.getDate() + 1);
        break;
      case "weekly":
        date.setDate(date.getDate() + 7);
        break;
      case "monthly":
        date.setMonth(date.getMonth() + 1);
        break;
      case "custom":
        date.setDate(date.getDate() + 1);
        break;
    }
  };

  while (current <= end && current <= recurrenceEnd) {
    if (shouldGenerate(current, event, originalDate))
      instances.push({
        ...event,
        id: `${event.id}-${localDateKey(current)}`,
        date: localDateKey(current),
        recurrenceParentId: event.id,
        isRecurring: false,
      });

    advance(current, event.recurrencePattern);
  }
  return instances;
};

/**
 * @param {Date} d1
 * @param {Date} d2
 */
const isSameDay = (d1, d2) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

/**
 * Local-timezone "YYYY-MM-DD" key for a Date (grid cells are local-midnight dates).
 * @param {Date} date
 */
export const localDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * Parse a "YYYY-MM-DD" key as a LOCAL-midnight Date (new Date(str) would read it as UTC).
 * @param {string} dateStr
 */
export const localDateFromKey = (dateStr) => {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/**
 * An event's day as a local date: a bare "YYYY-MM-DD" is that day wherever the
 * reader is, and a full timestamp is the local day it falls on.
 * @param {string} dateStr
 */
const eventDay = (dateStr) =>
  /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? localDateFromKey(dateStr) : new Date(dateStr);

/**
 * The local "YYYY-MM-DD" an event belongs to.
 * @param {CalendarEvent} event
 */
export const eventDateKey = (event) => localDateKey(eventDay(event.date));

/**
 * The seven local-midnight days of the Sunday-first week holding `date`.
 * @param {Date} date
 * @returns {Date[]}
 */
export const weekDaysOf = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (/** @type {unknown} */ _, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
};

/** @param {Date} date */
const isThisWeek = (date) => {
  const today = new Date();
  const weekFromNow = new Date(today.getTime() + 604800000);
  return date >= today && date <= weekFromNow;
};

/**
 * @param {string} dateStr
 * @param {string} locale
 */
const getDateSection = (dateStr, locale) => {
  const date = localDateFromKey(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameDay(date, today)) return "TODAY";
  if (isSameDay(date, tomorrow)) return "TOMORROW";
  if (isThisWeek(date))
    return date.toLocaleDateString(locale, { weekday: "long" }).toUpperCase();
  return date
    .toLocaleDateString(locale, { month: "short", day: "numeric" })
    .toUpperCase();
};

/** @param {CalendarEvent[]} events */
const groupEventsByDate = (events) =>
  events.reduce(
    (
      /** @type {Record<string, CalendarEvent[]>} */ groups,
      /** @type {CalendarEvent} */ event,
    ) => ({
      ...groups,
      [eventDateKey(event)]: [...(groups[eventDateKey(event)] || []), event],
    }),
    {},
  );

/**
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {CalendarEvent[]} events
 */
const getEventsInRange = (startDate, endDate, events) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  /** @type {CalendarEvent[]} */
  const withRecurring = [];

  events.forEach((/** @type {CalendarEvent} */ event) => {
    if (event.isRecurring)
      withRecurring.push(...generateRecurringInstances(event, start, end));
     else {
      const eventDate = eventDay(event.date);
      if (eventDate >= start && eventDate <= end)
        withRecurring.push(event);

    }
  });
  return withRecurring.sort((a, b) => eventDay(a.date).getTime() - eventDay(b.date).getTime());
};

/**
 * @param {number} month
 * @param {number} year
 * @param {string} locale
 */
const formatMonthYear = (month, year, locale) =>
  new Date(year, month, 1)
    .toLocaleDateString(locale, { month: "long", year: "numeric" })
    .toUpperCase();

/**
 * @param {number} year
 * @param {number} month
 * @param {CalendarEvent[]} events
 */
export const getDaysInMonth = (year, month, events) => {
  const days = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventsByDate = groupEventsByDate(events);

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    const dateStr = localDateKey(date);
    days.push({
      date,
      day: date.getDate(),
      isCurrentMonth: false,
      isToday: false,
      events: eventsByDate[dateStr] || [],
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = localDateKey(date);
    date.setHours(0, 0, 0, 0);
    days.push({
      date,
      day,
      isCurrentMonth: true,
      isToday: date.getTime() === today.getTime(),
      events: eventsByDate[dateStr] || [],
    });
  }

  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const date = new Date(year, month + 1, i);
    const dateStr = localDateKey(date);
    days.push({
      date,
      day: date.getDate(),
      isCurrentMonth: false,
      isToday: false,
      events: eventsByDate[dateStr] || [],
    });
  }

  return days;
};

export default defineComponent({
  tag: "lc-calendar",
  style: true,
  props: {

    events: /** @type {Prop<CalendarEvent[]>} */ (T.array({ defaultValue: [] })),

    viewMode: T.string({ defaultValue: "month", enum: ["list", "month", "week"] }),
    currentMonth: T.number(new Date().getMonth()),
    currentYear: T.number(new Date().getFullYear()),
    selectedDate: "",
    showDayPanel: false,
    dayPanel: true,

    showViewToggle: true,
    showNavigation: true,
    showTodayButton: true,
    locale: "en",
    monthsAhead: 3,

    renderEvent: /** @type {Prop<CalendarEventRenderer | null>} */ (T.function()),
    onDayDrop: /** @type {Prop<CalendarDayDrop | null>} */ (T.function()),
  },

  /**
   * @param {CalendarDay} dayObj
   * @param {DragEvent} e
   */
  _handleDayDrop(dayObj, e) {
    e.preventDefault();
    const draggedId = e.dataTransfer?.getData("text/plain");
    if (!draggedId) return;
    const dateStr = localDateKey(dayObj.date);
    this.onDayDrop?.(dateStr, draggedId, e);
  },

  getEventsForCalendar() {
    if (this.viewMode === "list") {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + this.monthsAhead);
      return getEventsInRange(today, endDate, this.events);
    }
    if (this.viewMode === "week") {
      const week = weekDaysOf(this._weekAnchor());
      return getEventsInRange(week[0], week[6], this.events);
    }
    const start = new Date(this.currentYear, this.currentMonth - this.monthsAhead, 1);
    const end = new Date(this.currentYear, this.currentMonth + this.monthsAhead + 1, 0);
    return getEventsInRange(start, end, this.events);
  },

  /** @param {number} direction */
  handleNav(direction) {
    if (direction === -1)
      if (this.currentMonth === 0) {
        this.currentMonth = 11;
        this.currentYear--;
      } else
        this.currentMonth--;

     else
      if (this.currentMonth === 11) {
        this.currentMonth = 0;
        this.currentYear++;
      } else
        this.currentMonth++;

    this.showDayPanel = false;
    this.$emit("month-change", {
      month: this.currentMonth,
      year: this.currentYear,
    });
  },

  _weekAnchor() {
    return this.selectedDate ? localDateFromKey(this.selectedDate) : new Date();
  },

  /** @param {number} direction */
  handleWeekNav(direction) {
    const anchor = this._weekAnchor();
    anchor.setDate(anchor.getDate() + direction * 7);
    this.selectedDate = localDateKey(anchor);
    const week = weekDaysOf(anchor);
    this.$emit("week-change", { start: localDateKey(week[0]), end: localDateKey(week[6]) });
  },

  /** @param {CalendarDay} dayObj */
  handleWeekDayClick(dayObj) {
    const dateStr = localDateKey(dayObj.date);
    this.selectedDate = dateStr;
    this.$emit("day-click", { date: dateStr, events: dayObj.events });
  },

  handleTodayClick() {
    const today = new Date();
    if (this.viewMode === "week") this.selectedDate = localDateKey(today);
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    this.showDayPanel = false;
  },

  /** @param {string} mode */
  handleViewToggle(mode) {
    this.viewMode = mode;
  },

  /** @param {CalendarDay} dayObj */
  handleDayClick(dayObj) {
    const dateStr = localDateKey(dayObj.date);
    const hasEvents = dayObj.events.length > 0;
    if (!this.dayPanel)
      this.selectedDate = dateStr;
    else if (this.selectedDate === dateStr)
      this.showDayPanel = !this.showDayPanel && hasEvents;
     else {
      this.selectedDate = dateStr;
      this.showDayPanel = hasEvents;
    }
    this.$emit("day-click", { date: dateStr, events: dayObj.events });
  },

  handleClosePanel() {
    this.showDayPanel = false;
  },

  /**
   * @param {CalendarEvent} event
   * @param {MouseEvent} [e]
   */
  handleEventClick(event, e) {
    e?.stopPropagation();
    this.$emit("event-click", { event });
  },

  getEventsForSelectedDay() {
    if (!this.selectedDate) return [];
    return this.getEventsForCalendar().filter(
      (e) => eventDateKey(e) === this.selectedDate,
    );
  },

  render() {
    const events = this.getEventsForCalendar();
    const groupedEvents = groupEventsByDate(events);

    return html`
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      </style>

      <div class="calendar-container" part="lc-calendar-container">
        ${this.showViewToggle ? this.renderViewToggle() : null}
        ${this.viewMode === "list"
          ? this.renderListView(groupedEvents)
          : this.viewMode === "week"
            ? this.renderWeekView(groupedEvents)
            : this.renderGridView(events)}
      </div>
    `;
  },

  renderViewToggle() {
    return html`
      <div class="view-toggle" part="lc-calendar-view-toggle">
        ${["list", "week", "month"].map(
          (mode) => html`
            <button
              @click=${() => this.handleViewToggle(mode)}
              class="toggle-btn ${this.viewMode === mode ? "active" : ""}"
              part="lc-calendar-toggle-btn ${this.viewMode === mode ? "lc-calendar-toggle-btn-active" : ""}"
            >
              ${lcText("lc-calendar", mode)}
            </button>
          `,
        )}
      </div>
    `;
  },

  /** @param {Record<string, CalendarEvent[]>} groupedEvents */
  renderWeekView(groupedEvents) {
    const today = new Date();
    const week = weekDaysOf(this._weekAnchor());
    const range = new Intl.DateTimeFormat(this.locale, { month: "short", day: "numeric", year: "numeric" })
      .formatRange(week[0], week[6]);
    const isDroppable = !!this.onDayDrop;

    return html`
      <div class="week-view" part="lc-calendar-week-view">
        ${this.showNavigation ? html`
          <div class="grid-header" part="lc-calendar-header">
            <button @click=${() => this.handleWeekNav(-1)} class="nav-btn" part="lc-calendar-nav-btn lc-calendar-nav-btn-prev">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <h2 class="month-label" part="lc-calendar-month-label lc-calendar-week-label">${range}</h2>
            <button @click=${() => this.handleWeekNav(1)} class="nav-btn" part="lc-calendar-nav-btn lc-calendar-nav-btn-next">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        ` : null}
        ${week.map((date) => {
          const key = localDateKey(date);
          /** @type {CalendarDay} */
          const dayObj = {
            date,
            day: date.getDate(),
            isCurrentMonth: true,
            isToday: isSameDay(date, today),
            events: groupedEvents[key] || [],
          };
          const isSelected = this.selectedDate === key;
          return html`
            <div
              class="week-day"
              part="lc-calendar-week-day ${dayObj.isToday ? "lc-calendar-week-day-today" : ""} ${isSelected ? "lc-calendar-week-day-selected" : ""}"
              data-date=${key}
              @click=${() => this.handleWeekDayClick(dayObj)}
              @dragover=${isDroppable ? (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; } : null}
              @drop=${isDroppable ? (/** @type {DragEvent} */ e) => this._handleDayDrop(dayObj, e) : null}
            >
              <div class="week-day-label" part="lc-calendar-week-day-label">
                <span part="lc-calendar-day-number lc-calendar-week-day-number ${dayObj.isToday ? "lc-calendar-week-day-number-today" : ""}">${dayObj.day}</span>
                <span part="lc-calendar-weekday-name">${date.toLocaleDateString(this.locale, { weekday: "long" })}</span>
              </div>
              <div class="week-events" part="lc-calendar-week-events">
                ${dayObj.events.map(
                  (event) => html`
                    <div
                      class="week-event"
                      part="lc-calendar-week-event"
                      data-category="${event.category || ""}"
                      @click=${(/** @type {MouseEvent} */ e) => this.handleEventClick(event, e)}
                    >
                      ${
                        this.renderEvent
                          ? this.renderEvent(event)
                          : html`
                              <div part="lc-calendar-week-event-card">
                                ${event.time ? html`<span part="lc-calendar-week-event-time">${event.time}</span>` : null}
                                <span part="lc-calendar-week-event-title">${event.title}</span>
                              </div>
                            `
                      }
                    </div>
                  `,
                )}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  },

  /** @param {Record<string, CalendarEvent[]>} groupedEvents */
  renderListView(groupedEvents) {
    const dateKeys = Object.keys(groupedEvents).sort();

    if (dateKeys.length === 0)
      return html`
        <div class="empty-state" part="lc-calendar-empty">
          <div class="empty-icon">📅</div>
          <p class="empty-text">${lcText("lc-calendar", "noneScheduled")}</p>
        </div>
      `;

    return html`
      <div class="list-view" part="lc-calendar-list">
        ${dateKeys.map((dateKey) => {
          const eventsForDate = groupedEvents[dateKey];
          const section = getDateSection(dateKey, this.locale);
          return html`
            <div class="list-section" part="lc-calendar-list-section">
              <h2 class="list-section-title" part="lc-calendar-list-section-title">${section}</h2>
              <div class="list-items">
                ${eventsForDate.map(
                  (/** @type {CalendarEvent} */ event) => html`
                    <div
                      @click=${(/** @type {MouseEvent} */ e) => this.handleEventClick(event, e)}
                      class="list-item"
                      part="lc-calendar-list-item"
                      data-category="${event.category || ""}"
                    >
                      ${event.image
                        ? html`<img
                            src="${event.image}"
                            alt="${event.title}"
                            class="list-item-image"
                            part="lc-calendar-list-item-image"
                          />`
                        : null}
                      <div class="list-item-content" part="lc-calendar-list-item-content">
                        <div class="list-item-header">
                          <h3 class="list-item-title" part="lc-calendar-list-item-title">${event.title}</h3>
                          ${event.recurrenceParentId
                            ? html`<span class="recurring-badge" part="lc-calendar-recurring-badge">🔁</span>`
                            : null}
                        </div>
                        <p class="list-item-meta" part="lc-calendar-list-item-meta">
                          ${event.time || ""} ${event.venue || event.address ? `• ${event.venue || event.address}` : ""}
                        </p>
                        <slot name="list-item-extra" .event=${event}></slot>
                      </div>
                    </div>
                  `,
                )}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  },

  /** @param {CalendarEvent[]} events */
  renderGridView(events) {
    const days = getDaysInMonth(this.currentYear, this.currentMonth, events);
    const monthYearLabel = formatMonthYear(this.currentMonth, this.currentYear, this.locale);
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return html`
      <div class="grid-view" part="lc-calendar-grid-view">
        ${this.showNavigation ? html`
          <div class="grid-header" part="lc-calendar-header">
            <button
              @click=${() => this.handleNav(-1)}
              class="nav-btn"
              part="lc-calendar-nav-btn lc-calendar-nav-btn-prev"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <h2 class="month-label" part="lc-calendar-month-label">${monthYearLabel}</h2>
            <button
              @click=${() => this.handleNav(1)}
              class="nav-btn"
              part="lc-calendar-nav-btn lc-calendar-nav-btn-next"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        ` : null}

        ${this.showTodayButton ? html`
          <button
            @click=${this.handleTodayClick.bind(this)}
            class="today-btn"
            part="lc-calendar-today-btn"
          >
            Jump to Today
          </button>
        ` : null}

        <div class="grid-container" part="lc-calendar-grid">
          <div class="weekday-header" part="lc-calendar-weekday-header">
            ${weekDays.map(
              (day) => html`<div class="weekday" part="lc-calendar-weekday">${day}</div>`,
            )}
          </div>
          <div class="days-grid" part="lc-calendar-days-grid">
            ${days.map((dayObj) => {
              const isSelected =
                this.selectedDate === localDateKey(dayObj.date);
              const hasEvents = dayObj.events.length > 0;
              const isDroppable = !!this.onDayDrop;
              return html`
                <div
                  @click=${() => this.handleDayClick(dayObj)}
                  @dragover=${isDroppable ? (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; } : null}
                  @drop=${isDroppable ? (/** @type {DragEvent} */ e) => this._handleDayDrop(dayObj, e) : null}
                  class="day-cell ${dayObj.isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${!dayObj.isCurrentMonth ? "other-month" : ""} ${hasEvents ? "has-events" : ""}"
                  part="lc-calendar-day ${dayObj.isToday ? "lc-calendar-day-today" : ""} ${isSelected ? "lc-calendar-day-selected" : ""} ${!dayObj.isCurrentMonth ? "lc-calendar-day-other-month" : ""}"
                >
                  <span class="day-number" part="lc-calendar-day-number">${dayObj.day}</span>
                  ${hasEvents
                    ? html`
                        <div class="day-events" part="lc-calendar-day-events">
                          ${dayObj.events.slice(0, 2).map((/** @type {CalendarEvent} */ event) =>
                            this.renderEvent
                              ? this.renderEvent(event)
                              : html`
                                  <div
                                    class="event-indicator"
                                    part="lc-calendar-event"
                                    data-category="${event.category || ""}"
                                  >
                                    ${event.title.length > 12
                                      ? event.title.substring(0, 12) + "..."
                                      : event.title}
                                  </div>
                                `,
                          )}
                          ${dayObj.events.length > 2
                            ? html`<div class="more-events" part="lc-calendar-more-events">+${dayObj.events.length - 2} more</div>`
                            : null}
                        </div>
                      `
                    : null}
                </div>
              `;
            })}
          </div>
        </div>

        ${this.showDayPanel ? this.renderDayDetailPanel() : null}
      </div>
    `;
  },

  renderDayDetailPanel() {
    const selectedEvents = this.getEventsForSelectedDay();
    const selectedDateObj = localDateFromKey(this.selectedDate);
    const dateLabel = selectedDateObj
      .toLocaleDateString(this.locale, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
      .toUpperCase();

    return html`
      <div
        @click=${this.handleClosePanel.bind(this)}
        class="panel-overlay"
        part="lc-calendar-panel-overlay"
        style="animation: fadeIn 0.2s ease-out;"
      ></div>
      <div class="day-panel" part="lc-calendar-panel" style="animation: slideUp 0.3s ease-out;">
        <div class="panel-header" part="lc-calendar-panel-header">
          <h3 class="panel-title" part="lc-calendar-panel-title">${dateLabel}</h3>
          <button
            @click=${this.handleClosePanel.bind(this)}
            class="panel-close"
            part="lc-calendar-panel-close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="panel-content" part="lc-calendar-panel-content">
          ${selectedEvents.length === 0
            ? html`<p class="panel-empty" part="lc-calendar-panel-empty">${lcText("lc-calendar", "noneThisDay")}</p>`
            : selectedEvents.map(
                (event) => html`
                  <div
                    @click=${(/** @type {MouseEvent} */ e) => this.handleEventClick(event, e)}
                    class="panel-item"
                    part="lc-calendar-panel-item"
                    data-category="${event.category || ""}"
                  >
                    ${event.image
                      ? html`<img
                          src="${event.image}"
                          alt="${event.title}"
                          class="panel-item-image"
                          part="lc-calendar-panel-item-image"
                        />`
                      : null}
                    <div class="panel-item-content" part="lc-calendar-panel-item-content">
                      <div class="panel-item-header">
                        <h4 class="panel-item-title" part="lc-calendar-panel-item-title">${event.title}</h4>
                        ${event.recurrenceParentId
                          ? html`<span class="recurring-badge" part="lc-calendar-recurring-badge">🔁</span>`
                          : null}
                      </div>
                      <p class="panel-item-meta" part="lc-calendar-panel-item-meta">
                        ${event.time || ""} ${event.venue || event.address ? `• ${event.venue || event.address}` : ""}
                      </p>
                    </div>
                  </div>
                `,
              )}
        </div>
      </div>
    `;
  },
});

/**
 * Calendar Component
 *
 * @component
 * @category display
 * @tag lc-calendar
 *
 * A full-featured calendar component with list, week and month grid views,
 * recurring event support, and day detail panels.
 *
 * @slot - Default slot for additional content
 *
 * @part container - Main calendar container
 * @part view-toggle - View mode toggle container
 * @part toggle-btn - Toggle button
 * @part toggle-btn-active - Active toggle button
 * @part header - Grid view header with navigation
 * @part nav-btn - Navigation buttons
 * @part month-label - Current month/year label
 * @part today-btn - Jump to today button
 * @part grid - Calendar grid container
 * @part weekday-header - Weekday names row
 * @part weekday - Individual weekday name
 * @part days-grid - Grid of day cells
 * @part day - Individual day cell
 * @part day-today - Today's day cell
 * @part day-selected - Selected day cell
 * @part day-other-month - Day cell from adjacent month
 * @part day-number - Day number text
 * @part day-events - Container for event indicators
 * @part event - Event indicator in grid
 * @part more-events - "+N more" indicator
 * @part list - List view container
 * @part list-section - Date section in list view
 * @part list-section-title - Section title (TODAY, TOMORROW, etc.)
 * @part list-item - Event item in list view
 * @part list-item-image - Event image in list
 * @part list-item-content - Event content container
 * @part list-item-title - Event title
 * @part list-item-meta - Event time/venue info
 * @part recurring-badge - Recurring event indicator
 * @part panel - Day detail panel
 * @part panel-overlay - Panel backdrop overlay
 * @part panel-header - Panel header
 * @part panel-title - Panel date title
 * @part panel-close - Panel close button
 * @part panel-content - Panel event list
 * @part panel-item - Event item in panel
 * @part panel-empty - Empty panel message
 * @part empty - Empty state container
 * @part week-view - Week view container
 * @part week-label - The week's date range in the week header (also part `month-label`)
 * @part week-day - One day row of the week view; also `week-day-today`, `week-day-selected`
 * @part week-day-label - The left column of a week row
 * @part week-day-number - The large day numeral (also part `day-number`); also `week-day-number-today`
 * @part weekday-name - The weekday under the numeral
 * @part week-events - The right column of a week row
 * @part week-event - The wrapper around one event in a week row
 * @part week-event-card - The default event card (time and title)
 * @part week-event-time - The default card's time
 * @part week-event-title - The default card's title
 *
 * @fires day-click - When a day is clicked. Detail: { date: string, events: array }
 * @fires event-click - When an event is clicked. Detail: { event: object }
 * @fires month-change - When month changes. Detail: { month: number, year: number }
 * @fires week-change - When the week view moves a week. Detail: { start: string, end: string }
 *
 * @example Basic Calendar
 * ```html
 * <lc-calendar
 *   .events=${[
 *     { id: "1", date: "2024-01-15", title: "Meeting" },
 *     { id: "2", date: "2024-01-20", title: "Conference", isRecurring: true, recurrencePattern: "weekly" }
 *   ]}
 * ></lc-calendar>
 * ```
 *
 * @example List View Only
 * ```html
 * <lc-calendar
 *   viewMode="list"
 *   .showViewToggle=${false}
 *   .events=${events}
 * ></lc-calendar>
 * ```
 */
