/**
 * @bootstrapp/light/html/template.js: prepared templates and their instances.
 * A template is prepared once per strings identity by the installed host
 * (`host.prepare`), which keeps whatever it needs beside the part specs; an
 * instance is a host clone of it with one part per spec, in document order.
 */

import { currentHost } from "./host.js";
import { createPart } from "./parts.js";

/** @import { Prepared } from "./host.js" */
/** @import { PartSpec } from "./types.ts" */

/** @type {WeakMap<ReadonlyArray<string>, Template>} */
const templateCache = new WeakMap();

export class Template {
  /**
   * @param {ReadonlyArray<string>} strings
   * @param {number} kind
   */
  constructor(strings, kind) {
    /** @type {Prepared} */
    this.prepared = currentHost().prepare(strings, kind);
    /** @type {PartSpec[]} */
    this.parts = this.prepared.parts;
    this.kind = kind;
  }
}

/**
 * Prepared-template cache, keyed on the TemplateStringsArray identity,
 * so template literals written once in a
 * render() are prepared once and diffed thereafter.
 *
 * @param {ReadonlyArray<string>} strings
 * @param {number} kind
 */
export const getTemplate = (strings, kind) => {
  let template = templateCache.get(strings);
  if (!template) {
    template = new Template(strings, kind);
    templateCache.set(strings, template);
  }
  return template;
};

export class TemplateInstance {
  /**
   * @param {Template} template
   * @param {object | undefined} owner
   */
  constructor(template, owner) {
    this.template = template;
    this.owner = owner;
    /** @type {ReturnType<typeof createPart>[]} */
    this.parts = [];
  }

  /** @returns {unknown} the clone's root, to insert where the instance renders */
  clone() {
    const clone = currentHost().clone(this.template.prepared);
    const specs = this.template.parts;
    for (let i = 0; i < specs.length; i++) this.parts.push(createPart(specs[i], clone.targets[i], this.owner));
    return clone.root;
  }

  /** @param {unknown[]} values */
  commit(values) {
    for (const part of this.parts) part.setFromValues(values);
  }

  dispose() {
    for (const part of this.parts) part.dispose();
  }
}
