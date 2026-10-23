import { html } from "@bootstrapp/light/html";

export default {
  description: "Several people as one overlapping row, with a count for the ones that do not fit.",
  preview: () => html`
    <lc-avatar-group max="3">
      <lc-avatar name="Ana Lima"></lc-avatar>
      <lc-avatar name="Bruno Reis"></lc-avatar>
      <lc-avatar name="Carla Dias"></lc-avatar>
      <lc-avatar name="Davi Souza"></lc-avatar>
      <lc-avatar name="Eva Luz"></lc-avatar>
    </lc-avatar-group>
  `,
  examples: [
    {
      title: "All of them fit",
      render: () => html`
        <lc-avatar-group>
          <lc-avatar name="Ana Lima"></lc-avatar>
          <lc-avatar name="Bruno Reis"></lc-avatar>
          <lc-avatar name="Carla Dias"></lc-avatar>
        </lc-avatar-group>
      `,
    },
    {
      title: "More than max",
      description: "Past max the rest are hidden and a +n avatar closes the row.",
      render: () => html`
        <lc-avatar-group max="3" size="md">
          <lc-avatar name="Ana Lima"></lc-avatar>
          <lc-avatar name="Bruno Reis"></lc-avatar>
          <lc-avatar name="Carla Dias"></lc-avatar>
          <lc-avatar name="Davi Souza"></lc-avatar>
          <lc-avatar name="Eva Luz"></lc-avatar>
          <lc-avatar name="Fabio Melo"></lc-avatar>
        </lc-avatar-group>
      `,
    },
  ],
};
