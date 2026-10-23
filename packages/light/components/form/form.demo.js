import { html } from "@bootstrapp/light/html";

const fields = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "kind", label: "Kind", type: "select", options: ["Talk", "Workshop", "Social"] },
  { name: "capacity", label: "Capacity", type: "number", min: 0 },
  { name: "online", label: "Online", type: "checkbox" },
  { name: "url", label: "Stream URL", type: "url", visibleIf: "online" },
];
const data = { title: "Lightning talks", kind: "Talk", capacity: 60, online: true, url: "" };

export default {
  description: "Takes a field list and draws it: which control each field gets, how it validates, whether it is even on screen.",
  preview: () => html`
    <lc-form .fields=${fields} .data=${data}></lc-form>
  `,
  previewWidth: 640,
  examples: [
    {
      title: "A field list",
      description: "The form decides which control each field gets; the view never dispatches on a type.",
      render: () => html`
        <lc-form .fields=${fields} .data=${data}></lc-form>
      `,
    },
    {
      title: "Stacked",
      render: () => html`
        <lc-form .fields=${fields} .data=${data} layout="stacked"></lc-form>
      `,
    },
    {
      title: "With errors",
      render: () => html`
        <lc-form .fields=${fields} .data=${{}} .errors=${{ title: "A title is required" }}></lc-form>
      `,
    },
  ],
};
