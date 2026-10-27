/**
 * @lightstart/light: the browser entry. The View custom element base class,
 * the definition wrappers and the engine's configuration; the host-neutral
 * update cycle those build on is ./core.js, and the browser shell is
 * dom/view.js.
 */
export { default, defineComponent, defineMixin } from "../dom/view.js";
export { configureView, trackWork, translate } from "./core.js";
