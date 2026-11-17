/** @file The one translation instance `configureI18n` makes, read by `t`, `language` and the model hooks. */
import { I18n } from "./i18n.ts";

let instance = new I18n();

/** The instance in use: an empty English one until `configureI18n` makes another. */
export const currentI18n = (): I18n => instance;

/** Make `next` the instance in use. */
export const useI18n = (next: I18n): void => {
  instance = next;
};
