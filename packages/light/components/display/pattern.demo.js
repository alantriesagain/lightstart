import { html } from "@bootstrapp/light/html";

export default {
  description: "A repeating background pattern drawn from the theme's colours.",
  preview: () => html`
    <lc-flex gap="sm">
      <lc-pattern pattern="dots" style="width:56px;height:56px"></lc-pattern>
      <lc-pattern pattern="grid" style="width:56px;height:56px"></lc-pattern>
      <lc-pattern pattern="diagonal" style="width:56px;height:56px"></lc-pattern>
    </lc-flex>
  `,
  examples: [
    {
      title: "Named patterns",
      render: () => html`
        <lc-flex gap="md" wrap="wrap">
          <lc-pattern pattern="dots" style="width:120px;height:80px"></lc-pattern>
          <lc-pattern pattern="grid" style="width:120px;height:80px"></lc-pattern>
          <lc-pattern pattern="diagonal" style="width:120px;height:80px"></lc-pattern>
        </lc-flex>
      `,
    },
    {
      title: "Random",
      render: () => html`
        <lc-pattern random style="width:280px;height:120px"></lc-pattern>
      `,
    },
  ],
};
