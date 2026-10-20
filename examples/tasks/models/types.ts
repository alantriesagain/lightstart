/**
 * @file The example's row types, read off its two models: a task and a board
 * as the store answers them.
 */
import type { ModelRow } from "@bootstrapp/light/model";
import type boards from "./boards.js";
import type tasks from "./tasks.js";

export type Task = ModelRow<typeof tasks>;
export type Board = ModelRow<typeof boards>;
