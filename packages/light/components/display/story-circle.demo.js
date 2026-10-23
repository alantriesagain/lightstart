import { html } from "@bootstrapp/light/html";

export default {
  description: "A ringed circle with a line under it: one person, place or happening in a row of stories.",
  preview: () => html`
    <lc-flex gap="sm" align="start">
      <lc-story-circle name="Martina" ring="primary" badge-icon="umbrella" sub="Ipanema"></lc-story-circle>
      <lc-story-circle name="Arpoador" ring="secondary" badge-text="6" sub="17:30"></lc-story-circle>
      <lc-story-circle name="You" ring="highlight" sub="Beach"></lc-story-circle>
    </lc-flex>
  `,
  examples: [
    {
      title: "Who is around",
      render: () => html`
        <lc-flex gap="sm" align="start">
          <lc-story-circle name="Martina Klein" label="Martina" ring="primary" badge-icon="umbrella" sub="Beach · Ipanema"></lc-story-circle>
          <lc-story-circle name="Tom Silva" label="Tom" ring="primary" badge-icon="beer" sub="Drinks · Botafogo"></lc-story-circle>
          <lc-story-circle name="Ana Ruiz" label="Ana" ring="muted" sub="Off"></lc-story-circle>
        </lc-flex>
      `,
    },
    {
      title: "Somebody you may not see yet",
      render: () => html`
        <lc-flex gap="sm" align="start">
          <lc-story-circle masked ring="muted" label="Beach" badge-icon="umbrella" sub="Ipanema"></lc-story-circle>
          <lc-story-circle masked ring="muted" label="Drinks" badge-icon="beer" sub="Botafogo"></lc-story-circle>
        </lc-flex>
      `,
    },
    {
      title: "A meetup, with its count",
      render: () => html`
        <lc-story-circle name="Arpoador sunset" label="Arpoador" ring="secondary" badge-text="6" sub="Meetup · 17:30"></lc-story-circle>
      `,
    },
    {
      title: "You, on",
      render: () => html`
        <lc-story-circle name="You" ring="highlight" badge-icon="umbrella" sub="until 22:00"></lc-story-circle>
      `,
    },
    {
      title: "Large, as a page's header",
      render: () => html`
        <lc-story-circle name="Martina Klein" size="lg" ring="primary" sub="Beach · Ipanema"></lc-story-circle>
      `,
    },
  ],
};
