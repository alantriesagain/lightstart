import { html } from "@bootstrapp/light/html";

const TWO_HOURS_AGO = new Date(Date.now() - 2 * 3600e3).toISOString();
const YESTERDAY = new Date(Date.now() - 26 * 3600e3).toISOString();

const moderation = () => html`
  <lc-button size="sm" ghost>Reply</lc-button>
  <lc-button size="sm" ghost>Hide</lc-button>
  <lc-button size="sm" ghost>Delete</lc-button>
`;

const unhide = () => html`<lc-button size="sm" ghost>Unhide</lc-button>`;

export default {
  description: "One comment in a thread: who wrote it, when, what it says and what can be done with it.",
  preview: () => html`
    <lc-comment author="Ana Souza" at=${TWO_HOURS_AGO} body="Went last Friday, the sunset was unreal."></lc-comment>
  `,
  previewWidth: 280,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-comment author="Ana Souza" at=${TWO_HOURS_AGO} body="Went last Friday, the sunset was unreal."></lc-comment>
      `,
    },
    {
      title: "Linked author with an avatar",
      description: "An absolute href opens in a new tab.",
      render: () => html`
        <lc-comment
          author="bruno.rio"
          href="https://www.instagram.com/bruno.rio"
          avatar="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&amp;h=80&amp;fit=crop"
          at=${YESTERDAY}
          body="Is it open on Sundays?"
        ></lc-comment>
      `,
    },
    {
      title: "Actions",
      render: () => html`
        <lc-comment
          author="Ana Souza"
          at=${TWO_HOURS_AGO}
          body="Went last Friday, the sunset was unreal."
          .actions=${moderation}
        ></lc-comment>
      `,
    },
    {
      title: "Hidden",
      description: "A comment the owner hid from the public draws muted, with a badge.",
      render: () => html`
        <lc-comment
          concealed
          author="spam.account"
          at=${YESTERDAY}
          body="Follow me for free followers!!!"
          .actions=${unhide}
        ></lc-comment>
      `,
    },
    {
      title: "A thread",
      render: () => html`
        <lc-flex direction="column" gap="md">
          <lc-comment author="Ana Souza" at=${YESTERDAY} body="Went last Friday, the sunset was unreal." .actions=${moderation}></lc-comment>
          <lc-comment author="bruno.rio" at=${TWO_HOURS_AGO} body="Same! We stayed until the lights came on. Worth the climb." .actions=${moderation}></lc-comment>
        </lc-flex>
      `,
    },
  ],
};
