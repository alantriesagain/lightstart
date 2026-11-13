import { html } from "fixture-lib";
export const markup = html;
import "./side.js";
export const load = () => import("fixture-lib/lazy.js");
export const note = "fixture-lib is not imported here";
export const n = 1;
