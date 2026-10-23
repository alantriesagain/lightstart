import { html } from "@bootstrapp/light/html";

export default {
  description: "A denser list entry built for a feed: leading media, two lines of text, a trailing state.",
  preview: () => html`<lc-list-row icon="bell" label="Ana asked to join" hint="Beach in Ipanema" meta="2h" unread></lc-list-row>`,
  examples: [
    {
      title: "A settings",
      render: () => html`
        <lc-list-row href="#" icon="video" label="Devices" hint="Rack cam" chevron></lc-list-row>
      `,
    },
    {
      title: "A nobody has read yet",
      render: () => html`
        <lc-list-row icon="bell" label="Ana asked to join" hint="Beach in Ipanema" meta="2h" unread></lc-list-row>
      `,
    },
    {
      title: "Selected",
      description: "The open entry of a list, tinted.",
      render: () => html`
        <lc-list-row icon="file-text" label="Spring launch" hint="Draft" selected></lc-list-row>
        <lc-list-row icon="file-text" label="Summer recap" hint="Scheduled"></lc-list-row>
      `,
    },
    {
      title: "A static row with a control of its own",
      description: "A plain box that leads nowhere: the control sits in the trailing slot.",
      render: () => html`
        <lc-list-row static icon="user" label="Ana" hint="Joined in May">
          <lc-button slot="trailing" size="sm" ghost icon="x">Remove</lc-button>
        </lc-list-row>
      `,
    },
    {
      title: "A notice whose text is the content",
      render: () => html`
        <lc-list-row wrap icon="megaphone" label="Welcome to meetup.rio" hint="Find the spots, meetups and nights out that people who live here recommend. Save what you like and take it with you." meta="2 months ago" unread></lc-list-row>
      `,
    },
  ],
};
