import { html } from "/app/__light-runtime__.js";

const ago = (hours) => new Date(Date.now() - hours * 3600e3).toISOString();

const TEN_MINUTES_AGO = ago(1 / 6);
const TWO_HOURS_AGO = ago(2);
const FIVE_HOURS_AGO = ago(5);
const YESTERDAY = ago(26);
const YESTERDAY_MORNING = ago(31);
const THREE_DAYS_AGO = ago(72).slice(0, 10);
const FOUR_DAYS_AGO = ago(4 * 24 + 3);

const FEED = [
  { at: TEN_MINUTES_AGO, title: "Post published", body: "Sunset over the harbour went out to 12.4k followers." },
  { at: TWO_HOURS_AGO, title: "Comment from Ana Souza", body: "Went last Friday, the sunset was unreal." },
  { at: FIVE_HOURS_AGO, title: "Post scheduled", body: "Goes out today at 18:30." },
  { at: YESTERDAY, title: "Draft saved" },
  { at: YESTERDAY_MORNING, title: "Profile connected", body: "Posts go out from bruno.rio." },
];

const PUBLISHING = [
  { at: TEN_MINUTES_AGO, title: "Published", icon: "check", variant: "success" },
  { at: TWO_HOURS_AGO, title: "Media URL did not answer", body: "Retried once, then gave up.", icon: "x", variant: "danger" },
  { at: FIVE_HOURS_AGO, title: "Waiting for the media to process", icon: "clock", variant: "warning" },
  { at: YESTERDAY, title: "Uploaded", icon: "upload", variant: "info" },
  { at: YESTERDAY_MORNING, title: "Draft created" },
];

const LINKED = [
  { at: TWO_HOURS_AGO, title: "Sunset over the harbour", href: "#post-harbour", variant: "success" },
  { at: YESTERDAY, title: "Lights on the hill", href: "#post-hill", variant: "warning" },
  { at: YESTERDAY_MORNING, title: "Market on a Sunday", href: "#post-market", variant: "danger" },
];

const DATED = [
  { at: TWO_HOURS_AGO, title: "Post published" },
  { at: THREE_DAYS_AGO, title: "Campaign starts", body: "No time set: the whole day.", icon: "calendar", variant: "primary" },
  { at: FOUR_DAYS_AGO, title: "Draft saved" },
];

const STATUS = { success: "Live", warning: "Scheduled", danger: "Failed" };

const status = (entry) => html`<lc-badge variant=${entry.variant}>${STATUS[entry.variant]}</lc-badge>`;

export default {
  description: "What happened and when, grouped under a heading per day with a marker for each entry.",
  preview: () => html`
    <lc-timeline .entries=${PUBLISHING.slice(0, 3)}></lc-timeline>
  `,
  previewWidth: 220,
  examples: [
    {
      title: "Activity feed",
      description: "Newest first, under Today and Yesterday.",
      render: () => html`
        <lc-timeline .entries=${FEED}></lc-timeline>
      `,
    },
    {
      title: "Oldest first",
      render: () => html`
        <lc-timeline oldest-first .entries=${FEED}></lc-timeline>
      `,
    },
    {
      title: "Icons and variants",
      description: "A marker takes an icon and the badge colours.",
      render: () => html`
        <lc-timeline .entries=${PUBLISHING}></lc-timeline>
      `,
    },
    {
      title: "Linked titles with extra content",
      description: "Whatever extra returns for an entry is drawn under it.",
      render: () => html`
        <lc-timeline .entries=${LINKED} .extra=${status}></lc-timeline>
      `,
    },
    {
      title: "A day with no time",
      description: "A date-only entry sits at the start of its day and shows no time.",
      render: () => html`
        <lc-timeline .entries=${DATED}></lc-timeline>
      `,
    },
  ],
};
