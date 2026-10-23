import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

export default defineComponent({
  tag: "lc-wizard",
  style: true,
  props: {

    currentStep: 1,
    totalSteps: 1,

    showProgress: true,
    showStepCounter: true,
    showHeader: true,
    showNavigation: true,
    modal: false,

    backLabel: "← Back",
    nextLabel: "",
    cancelLabel: "",
    finishLabel: "",
    stepLabel: "",

    canProceed: T.function(),
  },

  nextStep() {

    if (this.canProceed && !this.canProceed(this.currentStep))
      return false;

    const previousStep = this.currentStep;
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.$emit("step-change", {
        step: this.currentStep,
        previousStep,
        direction: "forward",
      });
      return true;
    }
      this.$emit("wizard-finish", {});
      return true;

  },

  prevStep() {
    const previousStep = this.currentStep;
    if (this.currentStep > 1) {
      this.currentStep--;
      this.$emit("step-change", {
        step: this.currentStep,
        previousStep,
        direction: "backward",
      });
      return true;
    }
      this.$emit("wizard-cancel", {});
      return false;

  },

  /** @param {number} step */
  goToStep(step) {
    if (step >= 1 && step <= this.totalSteps) {
      const previousStep = this.currentStep;
      const direction = step > previousStep ? "forward" : "backward";
      this.currentStep = step;
      this.$emit("step-change", {
        step: this.currentStep,
        previousStep,
        direction,
      });
      return true;
    }
    return false;
  },

  handleBackClick() {
    this.prevStep();
  },

  handleNextClick() {
    this.nextStep();
  },

  render() {
    const progress = (this.currentStep / this.totalSteps) * 100;
    const isFirstStep = this.currentStep === 1;
    const isLastStep = this.currentStep >= this.totalSteps;

    const stepSlots = [];
    for (let i = 1; i <= this.totalSteps; i++)
      stepSlots.push(html`
        <div
          class="step-content ${i === this.currentStep ? "active" : ""}"
          style="display: ${i === this.currentStep ? "block" : "none"}"
        >
          <slot name="step-${i}"></slot>
        </div>
      `);

    const content = html`
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .wizard-overlay {
          animation: fadeIn 0.2s ease-out;
        }
      </style>

      <div class="wizard-container" part="lc-wizard-container">
        ${this.showHeader ? html`
        <div class="wizard-header" part="lc-wizard-header">
          <button
            @click=${this.handleBackClick.bind(this)}
            class="btn-back"
            part="lc-wizard-btn-back"
          >
            ${isFirstStep ? this.cancelLabel || lcText("lc-wizard", "cancel") : this.backLabel}
          </button>
          ${this.showStepCounter
            ? html`
                <div class="step-counter" part="lc-wizard-step-counter">
                  ${this.stepLabel || lcText("lc-wizard", "step")} ${this.currentStep}/${this.totalSteps}
                </div>
              `
            : null}
          <div class="header-spacer"></div>
        </div>
        ` : null}

        ${this.showProgress
          ? html`
              <div class="wizard-progress" part="lc-wizard-progress">
                <div
                  class="wizard-progress-fill"
                  part="lc-wizard-progress-fill"
                  style="width: ${progress}%"
                ></div>
              </div>
            `
          : null}

        <div class="wizard-content" part="lc-wizard-content">
          ${stepSlots}
        </div>

        ${this.showNavigation
          ? html`
              <div class="wizard-footer" part="lc-wizard-footer">
                <slot name="footer">
                  <button
                    @click=${this.handleNextClick.bind(this)}
                    class="btn-next"
                    part="lc-wizard-btn-next"
                  >
                    ${isLastStep ? this.finishLabel || lcText("lc-wizard", "finish") : this.nextLabel || lcText("lc-wizard", "next")}
                  </button>
                </slot>
              </div>
            `
          : null}
      </div>
    `;

    if (this.modal)
      return html`
        <div
          class="wizard-overlay"
          part="lc-wizard-overlay"
          @click=${(e) => {
            if (e.target === e.currentTarget)
              this.$emit("wizard-cancel", {});

          }}
        >
          ${content}
        </div>
      `;

    return content;
  },
});

/**
 * Wizard Component
 *
 * @component
 * @category navigation
 * @tag lc-wizard
 *
 * A multi-step wizard/stepper component for guiding users through
 * sequential processes like onboarding, forms, or setup flows.
 *
 * @slot step-1 - Content for step 1
 * @slot step-2 - Content for step 2
 * @slot step-N - Content for step N (up to totalSteps)
 * @slot footer - Custom footer content (replaces default next button)
 *
 * @part overlay - Modal backdrop (when modal=true)
 * @part container - Main wizard container
 * @part header - Header with back button and step counter
 * @part btn-back - Back/cancel button
 * @part step-counter - Step X/Y indicator
 * @part progress - Progress bar container
 * @part progress-fill - Progress bar fill element
 * @part content - Step content area
 * @part footer - Footer with navigation button
 * @part btn-next - Next/finish button
 *
 * @fires step-change - When step changes. Detail: { step, previousStep, direction }
 * @fires wizard-finish - When wizard completes (next on last step)
 * @fires wizard-cancel - When wizard is cancelled (back on first step or overlay click)
 *
 * @example Basic Wizard
 * ```html
 * <lc-wizard .totalSteps=${3}>
 *   <div slot="step-1">
 *     <h2>Welcome</h2>
 *     <p>Let's get started!</p>
 *   </div>
 *   <div slot="step-2">
 *     <h2>Your Details</h2>
 *     <input type="text" placeholder="Name" />
 *   </div>
 *   <div slot="step-3">
 *     <h2>Complete!</h2>
 *     <p>You're all set.</p>
 *   </div>
 * </lc-wizard>
 * ```
 *
 * @example Modal Wizard
 * ```html
 * <lc-wizard
 *   modal
 *   .totalSteps=${4}
 *   nextLabel="Continue →"
 *   finishLabel="Complete ✨"
 *   @wizard-finish=${handleComplete}
 *   @wizard-cancel=${handleClose}
 * >
 *   <div slot="step-1">Step 1 content</div>
 *   <div slot="step-2">Step 2 content</div>
 *   <div slot="step-3">Step 3 content</div>
 *   <div slot="step-4">Step 4 content</div>
 * </lc-wizard>
 * ```
 *
 * @example Wizard with Validation
 * ```html
 * <lc-wizard
 *   .totalSteps=${3}
 *   .canProceed=${(step) => {
 *     if (step === 1) return !!this.name;
 *     if (step === 2) return !!this.email;
 *     return true;
 *   }}
 * >
 *   ...
 * </lc-wizard>
 * ```
 */
