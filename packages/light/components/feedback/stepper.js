import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
/** @import { Prop, StepperStep } from "../types.ts" */

/**
 * @param {number} index
 * @param {number} currentIndex
 * @param {string} state
 * @returns {string}
 */
const stepState = (index, currentIndex, state) => {
  if (currentIndex === -1) return state === "done" ? "done" : "pending";
  if (index < currentIndex) return "done";
  if (index > currentIndex) return "pending";
  return state === "idle" ? "active" : state;
};

/**
 * @param {string} state
 * @param {number} number
 * @param {boolean} vertical
 */
const markerOf = (state, number, vertical) => {
  if (state === "done") return html`<lc-icon name="check"></lc-icon>`;
  if (state === "failed") return html`<lc-icon name="x"></lc-icon>`;
  if (vertical) return nothing;
  if (state === "running") return html`<lc-spinner size="xs"></lc-spinner>`;
  return String(number);
};

export default defineComponent({
  tag: "lc-stepper",
  style: true,
  props: {
    steps: /** @type {Prop<StepperStep[]>} */ (T.array({ defaultValue: [] })),
    current: "",
    state: T.string({ defaultValue: "idle", enum: ["idle", "running", "done", "failed"] }),
    error: "",
    size: T.string({ defaultValue: "md", enum: ["sm", "md"] }),
    vertical: T.boolean(),
  },
  render() {
    const currentIndex = this.steps.findIndex((step) => step.id === this.current);
    return html`
      <ol class="stepper-steps" part="lc-stepper-steps">
        ${this.steps.map((step, index) => {
          const state = step.done ? "done" : stepState(index, currentIndex, this.state);
          return html`
            <li
              class="stepper-step"
              part="lc-stepper-step"
              data-step=${step.id}
              data-state=${state}
              aria-current=${index === currentIndex ? "step" : nothing}
            >
              <span class="stepper-dot" part="lc-stepper-dot">${markerOf(state, index + 1, this.vertical)}</span>
              ${
                this.vertical
                  ? html`<span class="stepper-text" part="lc-stepper-text">
                      <span class="stepper-label" part="lc-stepper-label">${step.label}</span>
                      ${step.description ? html`<span class="stepper-description" part="lc-stepper-description">${step.description}</span>` : nothing}
                    </span>`
                  : html`<span class="stepper-label" part="lc-stepper-label">${step.label}</span>`
              }
            </li>
          `;
        })}
      </ol>
      ${this.state === "failed" && this.error
        ? html`<p class="stepper-error" part="lc-stepper-error" role="alert">${this.error}</p>`
        : ""}
    `;
  },
});

/**
 * Stepper Component
 *
 * @component
 * @category feedback
 * @tag lc-stepper
 *
 * Where a multi-step job has got to: a row of numbered dots joined by lines,
 * each with its label under it. Steps before `current` are done, `current` is
 * drawn by `state` (a number while idle, a spinner while running, a check when
 * done, an x when failed), and the steps after it wait. With `state="failed"`
 * and an `error`, the error is drawn under the row. Each step carries its id as
 * `data-step` and what it is showing as `data-state`. A step with `done: true` is
 * done whatever `current` says.
 *
 * `vertical` draws a column instead: a 16px ring per step (filled with a check
 * once done, in ink for the current step, a hairline while it waits) beside the
 * label and the step's `description`.
 *
 * @example Running
 * ```js
 * html`<lc-stepper
 *   .steps=${[{ id: "upload", label: "Upload" }, { id: "process", label: "Process" }, { id: "publish", label: "Publish" }]}
 *   current="process"
 *   state="running"
 * ></lc-stepper>`
 * ```
 *
 * @example Vertical, with descriptions
 * ```js
 * html`<lc-stepper vertical .steps=${[{ id: "a", label: "Connect", description: "Link the account", done: true }, { id: "b", label: "Publish" }]} current="b"></lc-stepper>`
 * ```
 *
 * @example Failed with a reason
 * ```js
 * html`<lc-stepper .steps=${steps} current="publish" state="failed" error="The media URL did not answer."></lc-stepper>`
 * ```
 */
