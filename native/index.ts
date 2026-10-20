/**
 * @bootstrapp/light/native: light on the terminal, the entry a native
 * build compiles. Importing it installs the terminal host and light's
 * signals as the effect adapter; it re-exports the html core, the signals,
 * the view core and the terminal host.
 */
import { configure } from "../html/core.ts";
import { effect } from "../signals/index.ts";
import { TermHost } from "../tdom/host.ts";

configure({ host: new TermHost(), effect });

export * from "../html/core.ts";
export * from "../signals/index.ts";
export { ViewCore, configureView, trackWork, translate } from "../view/core.ts";
export * from "../tdom/index.ts";
export { runApp } from "./app.ts";
