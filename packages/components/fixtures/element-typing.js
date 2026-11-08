/**
 * The element a page holds for an `lc-*` tag, held by the type checker:
 * `npm run typecheck` fails when a line below stops meaning what it says.
 */

const wizard = document.createElement("lc-wizard");
/** @type {number} */ export const step = wizard.currentStep;
/** @type {boolean} */ export const modal = wizard.modal;
// @ts-expect-error a prop keeps the type its descriptor declares
/** @type {string} */ export const wrong = wizard.currentStep;
// @ts-expect-error an element has no member its definition does not give it
export const missing = wizard.notDeclared;

export const found = document.querySelector("lc-input");
/** @type {string | null | undefined} */ export const label = found?.label;
