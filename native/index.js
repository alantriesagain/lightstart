/**
 * @bootstrapp/light/native: light on the terminal, the entry a native
 * build compiles. Importing it installs the terminal host and light's
 * signals as the effect adapter; it re-exports the html core, the signals,
 * the view core and the terminal host.
 */
import { configure } from "../html/core.js";
import { effect } from "../signals/index.js";
import { TermHost } from "../tdom/host.js";

configure({ host: new TermHost(), effect });

export * from "../html/core.js";
export * from "../signals/index.js";
export { ViewCore, configureView, trackWork, translate } from "../view/core.js";
export * from "../tdom/index.ts";
