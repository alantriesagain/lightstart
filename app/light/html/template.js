/**
 * @bootstrapp/light/html/template: prepared templates and their instances.
 * A template is prepared once per strings identity by the installed host
 * (`host.prepare`), which keeps whatever it needs beside the part specs; an
 * instance is a host clone of it with one part per spec, in document order.
 */

                                      
import { currentHost } from "./host.js";
import { createPart } from "./parts.js";

                                                
                                           

const templateCaches                                           = new WeakMap();

export class Template {
  prepared          ;
  parts            ;
  kind        ;

  constructor(strings                       , kind        ) {
    this.prepared = currentHost().prepare(strings, kind);
    this.parts = this.prepared.parts;
    this.kind = kind;
  }
}

/**
 * Prepared-template cache, keyed on the TemplateStringsArray identity,
 * so template literals written once in a
 * render() are prepared once and diffed thereafter. `strings` stays
 * `unknown` up to here so a native build keeps that identity.
 */
export const getTemplate = (strings         , kind        ) => {
  const host = currentHost();
  let cache = templateCaches.get(host);
  if (cache === undefined) {
    cache = new WeakMap();
    templateCaches.set(host, cache);
  }
  const key = strings          ;
  let template = cache.get(key);
  if (template === undefined) {
    template = new Template(strings                         , kind);
    cache.set(key, template);
  }
  return template;
};

export class TemplateInstance {
  template          ;
  owner                    ;
  parts        ;

  constructor(template          , owner                    ) {
    this.template = template;
    this.owner = owner;
    this.parts = [];
  }

  /** @returns the clone's root, to insert where the instance renders */
  clone()          {
    const clone = currentHost().clone(this.template.prepared);
    const specs = this.template.parts;
    for (let i = 0; i < specs.length; i++) this.parts.push(createPart(specs[i], clone.targets[i], this.owner));
    return clone.root;
  }

  commit(values           ) {
    for (const part of this.parts) part.setFromValues(values);
  }

  dispose() {
    for (const part of this.parts) part.dispose();
  }
}
