import { shared } from "./shared.js";

export const value = shared;
export const later = () => import("./lazy.js");
