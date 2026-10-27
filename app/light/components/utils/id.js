/**
 * @bootstrapp/light/components/utils/id
 *
 * One source of element ids for the components that have to invent one:
 * a control that needs an id for its `<label for>`, a tablist wiring
 * `aria-controls` to `aria-labelledby`. A counter rather than a random suffix,
 * because these ids are only ever compared inside one document, and a counter
 * cannot collide, reads plainly in a devtools tree, and is baked and rebooted
 * to the same value by a static render.
 */

let counter = 0;

/**
 * The next id under `prefix`, unique for the life of the page.
 * @param {string} prefix
 * @returns {string}
 */
export const uniqueId = (prefix) => `${prefix}${++counter}`;

/** Reset the counter. For tests; nothing in a running page calls it. */
export const resetIds = () => {
  counter = 0;
};
