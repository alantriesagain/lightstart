/**
 * The playground's controls: one row per declared prop, the control drawn by
 * the form's field registry so it matches every other form in the app.
 */
import { html, nothing } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import View, { defineComponent } from "@lightstart/light";
import { renderFormControl } from "@lightstart/components/form/field-renderers.js";
import labelDef from "@lightstart/components/form/label.js";
import iconDef from "@lightstart/components/display/icon.js";
import tagDef from "@lightstart/components/display/tag.js";
import inputDef from "@lightstart/components/form/input.js";
import selectDef from "@lightstart/components/form/select.js";
import checkboxDef from "@lightstart/components/form/checkbox.js";
import textareaDef from "@lightstart/components/form/textarea.js";

/** @import { ComponentPropertyMeta, Renderable } from "../lib/types.ts" */
/** @import { FormField } from "@lightstart/components/types.ts" */
/** @import { TypeDefinition } from "@lightstart/light/types" */

View.define(labelDef);
View.define(iconDef);
View.define(tagDef);
View.define(inputDef);
View.define(selectDef);
View.define(checkboxDef);
View.define(textareaDef);

/** @param {string} key */
const attributeOf = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const view = defineComponent({
  tag: "showcase-property-editor",
  style: true,
  props: {
    declarations: /** @type {TypeDefinition<Record<string, ComponentPropertyMeta>>} */ (
      /** @type {unknown} */ (T.object({ defaultValue: {} }))
    ),
    values: /** @type {TypeDefinition<Record<string, Renderable>>} */ (
      /** @type {unknown} */ (T.object({ defaultValue: {} }))
    ),
  },

  /**
   * @param {string} key
   * @param {unknown} value
   */
  handleChange(key, value) {
    this.$emit("property-change", { key, value });
  },

  /**
   * @param {string} key
   * @param {ComponentPropertyMeta} metadata
   * @returns {FormField}
   */
  propertyField(key, metadata) {
    const enumValues = metadata.enum;
    if (enumValues?.length)
      return { name: key, type: "select", label: "", options: [...enumValues], size: "sm" };
    if (metadata.type === "boolean")
      return { name: key, type: "switch", label: "", checkboxLabel: "", size: "sm" };
    return {
      name: key,
      label: "",
      size: "sm",
      type: metadata.type === "number" ? "number" : metadata.type === "array" || metadata.type === "object" ? "json" : "text",
    };
  },

  /**
   * @param {string} key
   * @param {ComponentPropertyMeta} metadata
   */
  renderRow(key, metadata) {
    const enumValues = metadata.enum;
    const described = enumValues?.length ? enumValues.join(" · ") : metadata.type || "unknown";
    const name = html`
      <div class="prop-name">
        <span>${attributeOf(key)}${metadata.required ? html`<em>required</em>` : nothing}</span>
        <small>${described}</small>
      </div>
    `;

    if (metadata.type === "function")
      return html`<div class="prop-row is-inert">${name}<span class="prop-note">Bound in code</span></div>`;

    const field = this.propertyField(key, metadata);
    const control = renderFormControl(
      field,
      this.values[key] ?? metadata.defaultValue,
      (value) => this.handleChange(key, field.type === "number" ? Number(value) || 0 : value),
      html,
    );

    return html`
      <div class="prop-row ${field.type === "json" ? "is-wide" : ""}">
        ${name}
        <div class="prop-control">${control}</div>
      </div>
    `;
  },

  render() {
    const entries = Object.entries(this.declarations || {});
    if (!entries.length) return html`<p class="prop-empty">This component declares no props.</p>`;
    return html`${entries.map(([key, metadata]) => this.renderRow(key, metadata))}`;
  },
});

View.define(view);

export default view;
