/**
 * Projects built with Light, as the home page's strip and the /built-with-light
 * gallery draw them. Pure data: add a project here and both pages follow.
 */
import { GITHUB_URL } from "./paths.js";

/**
 * @typedef {object} Project
 * @property {string} name
 * @property {string} url
 * @property {string} description
 * @property {string} icon
 * @property {string} accent
 * @property {string[]} tags
 * @property {string} author
 * @property {string} [status]
 * @property {string} [image] A cover image URL; the icon is drawn when it is absent.
 */

/** @type {Project[]} */
export const PROJECTS = [
  {
    name: "Lightstart",
    url: "https://lightstart.dev",
    description: "The site you are reading: every component, example and skin drawn from the package's own demo files.",
    icon: "box",
    accent: "#e4572e",
    tags: ["Documentation", "PWA", "Open source"],
    author: "Alan Meira",
    status: "Open source",
  },
  {
    name: "Bootstrapp",
    url: "https://app.bootstrapp.ai",
    description: "A creator studio that covers the whole loop: plan, make, post and read the results in one place.",
    icon: "sparkles",
    accent: "#14b8a6",
    tags: ["Creator tools", "SaaS"],
    author: "Bootstrapp",
    status: "Live",
  },
  {
    name: "Meetup Rio",
    url: "https://meetup.rio",
    description: "Things to do in Rio, with friends: events, meetups and places on a map, and the people going.",
    icon: "map-pin",
    accent: "#0ea5e9",
    tags: ["Social", "Maps", "PWA"],
    author: "Alan Meira",
    status: "Live",
  },
  {
    name: "Alan Tries Again",
    url: "https://alantriesagain.com",
    description: "A personal blog about software and the links worth keeping, with its own admin.",
    icon: "newspaper",
    accent: "#a855f7",
    tags: ["Blog", "CMS"],
    author: "Alan Meira",
    status: "Live",
  },
  {
    name: "Tasks",
    url: `${GITHUB_URL}/tree/main/examples/tasks`,
    description: "The terminal reference app: boards, live model queries and a native binary with no JavaScript engine.",
    icon: "square-terminal",
    accent: "#84cc16",
    tags: ["Terminal", "Native", "Open source"],
    author: "Light examples",
    status: "Open source",
  },
];

const SUBMISSION = new URLSearchParams({
  title: "Project built with Light",
  body: ["Name:", "URL:", "What it does:", "What it uses from Light:", ""].join("\n"),
});

export const SUBMIT_PROJECT_URL = `${GITHUB_URL}/issues/new?${SUBMISSION}`;
