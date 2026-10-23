import { html } from "@bootstrapp/light/html";

export default {
  description: "A person as an image, initials or an icon, alone or stacked in a group.",
  preview: () => html`
    <lc-flex gap="sm" align="center">
      <lc-avatar name="Jane Smith" status="online"></lc-avatar>
      <lc-avatar name="Bob Lee" shape="rounded"></lc-avatar>
      <lc-avatar name="Ana" size="lg"></lc-avatar>
    </lc-flex>
  `,
  examples: [
    {
      title: "Image",
      render: () => html`
        <lc-avatar src="/path/to/image.jpg" name="John Doe"></lc-avatar>
      `,
    },
    {
      title: "Initials",
      render: () => html`
        <lc-avatar name="Jane Smith"></lc-avatar>
        <lc-avatar name="Bob"></lc-avatar>
      `,
    },
    {
      title: "A thumbnail with its own glyph",
      description: "Not a person: the icon says what the thing is when there is no image, and takes over when the image fails to load.",
      render: () => html`
        <lc-avatar shape="rounded" icon="map-pin"></lc-avatar>
        <lc-avatar shape="rounded" icon="map-pin" src="/missing.jpg"></lc-avatar>
        <lc-avatar icon="message-circle"></lc-avatar>
      `,
    },
    {
      title: "No name or image",
      render: () => html`
        <lc-avatar></lc-avatar>
        <lc-avatar size="lg"></lc-avatar>
      `,
    },
    {
      title: "Sizes",
      render: () => html`
        <lc-avatar name="XS" size="xs"></lc-avatar>
        <lc-avatar name="SM" size="sm"></lc-avatar>
        <lc-avatar name="MD" size="md"></lc-avatar>
        <lc-avatar name="LG" size="lg"></lc-avatar>
        <lc-avatar name="XL" size="xl"></lc-avatar>
      `,
    },
    {
      title: "Shapes",
      render: () => html`
        <lc-avatar name="C" shape="circle"></lc-avatar>
        <lc-avatar name="S" shape="square"></lc-avatar>
        <lc-avatar name="R" shape="rounded"></lc-avatar>
      `,
    },
    {
      title: "Status indicator",
      render: () => html`
        <lc-avatar name="John" status="online"></lc-avatar>
        <lc-avatar name="Jane" status="offline"></lc-avatar>
        <lc-avatar name="Bob" status="busy"></lc-avatar>
        <lc-avatar name="Alice" status="away"></lc-avatar>
      `,
    },
  ],
};
