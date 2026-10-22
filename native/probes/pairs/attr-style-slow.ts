import { html } from "../../../html/core.ts";
import { TemplateInstance, getTemplate } from "../../../html/template.ts";
import "../../tui/index.ts";

const strings = html`<text fg="red" bold>${0} ${1}</text>`.strings;
const template = getTemplate(strings, 1);
const start = performance.now();
let made = 0;
for (let i = 0; i < 20_000; i++) {
  new TemplateInstance(template, undefined).clone();
  made++;
}
console.log(made);
console.error(`${(performance.now() - start).toFixed(1)}`);

export {};
