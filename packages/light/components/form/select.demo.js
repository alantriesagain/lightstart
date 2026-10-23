import { html } from "@bootstrapp/light/html";

export default {
  description: "A dropdown of options, with search and multiple selection when the list is long.",
  preview: () => html`
    <lc-select label="Country" value="Brazil" options='["Brazil", "Portugal", "Spain"]'></lc-select>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-select
          value="Option 2"
          options='["Option 1", "Option 2", "Option 3"]'
        ></lc-select>
      `,
    },
    {
      title: "Label and placeholder",
      render: () => html`
        <lc-select
          label="Choose Color"
          placeholder="Select a color..."
          options='[
            { "value": "red", "label": "Red" },
            { "value": "green", "label": "Green" },
            { "value": "blue", "label": "Blue" }
          ]'
        ></lc-select>
      `,
    },
    {
      title: "In a form",
      render: () => html`
        <form>
          <lc-select
            name="country"
            label="Country"
            required
            options='["USA", "UK", "Canada"]'
          ></lc-select>
        </form>
      `,
    },
    {
      title: "Disabled state",
      render: () => html`
        <lc-select
          disabled
          value="disabled"
          options='["This select is disabled"]'
        ></lc-select>
      `,
    },
  ],
};
