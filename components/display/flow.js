import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
/** @import { Prop, FlowLane, FlowStep } from "../types.ts" */

/**
 * The cells of one lane under `count` phases: the steps each phase holds, and
 * whether the lane passes through an empty phase on its way to a later step.
 * @param {FlowLane} lane
 * @param {number} count
 * @returns {{ steps: FlowStep[], pass: boolean }[]}
 */
const cellsOf = (lane, count) => {
  const cells = Array.from({ length: count }, () => ({ steps: /** @type {FlowStep[]} */ ([]), pass: false }));
  for (const step of lane.steps) cells[Math.min(Math.max(step.phase ?? 0, 0), count - 1)].steps.push(step);
  const used = cells.map((cell) => cell.steps.length > 0);
  const first = used.indexOf(true);
  const last = used.lastIndexOf(true);
  for (let i = first + 1; i < last; i++) if (!used[i]) cells[i].pass = true;
  return cells;
};

export default defineComponent({
  tag: "lc-flow",
  style: true,
  props: {
    lanes: /** @type {Prop<FlowLane[]>} */ (T.array({ defaultValue: [] })),
    phases: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),
    selected: "",
  },
  events: {
    "flow-select": T.object({ lane: T.string(), step: T.string() }),
  },

  /**
   * @param {FlowLane} lane
   * @param {FlowStep} step
   */
  _pick(lane, step) {
    if (step.id === this.selected) return;
    this.selected = step.id;
    this.$emit("flow-select", { lane: lane.id, step: step.id });
  },

  /**
   * @param {FlowLane} lane
   * @param {FlowStep} step
   * @param {boolean} after whether a step comes before this one in the lane
   */
  _step(lane, step, after) {
    const phase = this.phases[step.phase ?? 0];
    return html`
      <button
        type="button"
        class="flow-step"
        part="lc-flow-step"
        data-tone=${step.tone ?? nothing}
        ?data-after=${after}
        aria-pressed=${step.id === this.selected ? "true" : "false"}
        @click=${() => this._pick(lane, step)}
      >
        ${phase ? html`<span class="flow-step-phase">${phase}</span>` : nothing}
        <span class="flow-step-label">${step.label}</span>
        ${step.detail ? html`<span class="flow-step-detail">${step.detail}</span>` : nothing}
      </button>
    `;
  },

  render() {
    const count = Math.max(this.phases.length, 1);
    return html`
      <div class="flow" role="group" style=${`--lc-flow-phases: ${count}`} ?data-phased=${this.phases.length > 0}>
        ${this.phases.length
          ? html`<span class="flow-corner"></span>${this.phases.map((phase) => html`<span class="flow-phase">${phase}</span>`)}`
          : nothing}
        ${this.lanes.map((lane) => {
          let seen = false;
          return html`
            <div class="flow-lane-label" part="lc-flow-lane">
              <b>${lane.label}</b>
              ${lane.detail ? html`<span>${lane.detail}</span>` : nothing}
            </div>
            ${cellsOf(lane, count).map(
              (cell) => html`
                <div class="flow-cell" ?data-pass=${cell.pass} ?data-empty=${!cell.steps.length && !cell.pass}>
                  ${cell.steps.map((step) => {
                    const after = seen;
                    seen = true;
                    return this._step(lane, step, after);
                  })}
                </div>
              `,
            )}
          `;
        })}
      </div>
    `;
  },
});

/**
 * Flow Component
 *
 * @component
 * @category display
 * @tag lc-flow
 *
 * Steps in lanes, each lane read left to right, with an arrow from every step
 * to the next. Several lanes compare paths through the same process: name the
 * `phases` and give each step the index of its phase, and the lanes line up
 * under the phase headings, a lane drawing a line through a phase it skips.
 *
 * Every step is a button: pressing one makes it `selected` and fires
 * `flow-select` with the lane's and the step's ids, so the page can show what
 * that step is about. Step ids are unique across lanes. A step's `tone` is
 * `accent` (the one to look at) or `muted` (one that is there for context).
 *
 * In a narrow container the lanes stack and each lane runs top to bottom,
 * every step carrying its phase's name.
 *
 * @example
 * ```html
 * <lc-flow .phases=${["Write", "Build", "Run"]} .lanes=${lanes} selected="v8" @flow-select=${(e) => show(e.detail.step)}></lc-flow>
 * ```
 */
