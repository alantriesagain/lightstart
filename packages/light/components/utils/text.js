import { translate } from "@bootstrapp/light";
import en from "../../locales/en.js";

/** @type {(s: string, params: Record<string, unknown>) => string} */
const fill = (s, params) => s.replace(/\{(\w+)\}/g, (m, /** @type {string} */ k) => (k in params ? String(params[k]) : m));

/**
 * A word the library draws: the host's translation of `<tag>.<key>` when it
 * has one (light's `translate`, which Bootstrapp's i18n fills from the merged
 * locale files), and the English from light's `locales/en.js` otherwise (or the `words` a component outside light hands in), which is the
 * normal path on a page without translations, not an error case.
 * @type {(tag: string, key: string, params?: Record<string, unknown>, words?: Record<string, string>) => string}
 */
export const lcText = (tag, key, params = {}, words = /** @type {Record<string, Record<string, string>>} */ (en)[tag]) => {
  const path = `${tag}.${key}`;
  const found = translate(path, params);
  if (found) return found;
  const english = words?.[key];
  return english ? fill(english, params) : key;
};
