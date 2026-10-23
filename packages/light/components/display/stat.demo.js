import { html } from "@bootstrapp/light/html";

export default {
  description: "One number with its label and its movement since last time.",
  slot: () => html`+12% from last month`,
  preview: () => html`<lc-stat title="Total Users" value="1,234" variant="success">↑ 12% from last month</lc-stat>`,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-stat title="Total Users" value="1,234"></lc-stat>
      `,
    },
    {
      title: "Description",
      render: () => html`
        <lc-stat title="Downloads" value="31K" desc="Jan 1st - Feb 1st"></lc-stat>
      `,
    },
    {
      title: "Icon figure",
      render: () => html`
        <lc-stat title="Total Likes" value="25.6K" variant="primary">
          <lc-icon slot="figure" name="heart" size="lg"></lc-icon>
          21% more than last month
        </lc-stat>
      `,
    },
    {
      title: "Colored variants",
      render: () => html`
        <lc-stat title="Active" value="85" variant="success">↑ 12%</lc-stat>
        <lc-stat title="Errors" value="3" variant="danger">↓ 5%</lc-stat>
      `,
    },
    {
      title: "Grouped",
      render: () => html`
        <lc-join>
          <lc-stat title="Downloads" value="31K">Jan 1st - Feb 1st</lc-stat>
          <lc-stat title="New Users" value="4,200">↑ 400 (22%)</lc-stat>
          <lc-stat title="New Registers" value="1,200">↓ 90 (14%)</lc-stat>
        </lc-join>
      `,
    },
    {
      title: "Icons grouped",
      render: () => html`
        <lc-join>
          <lc-stat title="Total Likes" value="25.6K" variant="primary">
            <lc-icon slot="figure" name="heart"></lc-icon>
            21% more than last month
          </lc-stat>
          <lc-stat title="Page Views" value="2.6M" variant="secondary">
            <lc-icon slot="figure" name="zap"></lc-icon>
            21% more than last month
          </lc-stat>
        </lc-join>
      `,
    },
    {
      title: "Delta",
      description: "A pill after the value, tinted by the trend.",
      render: () => html`
        <lc-stat title="Reach" value="48.2K" delta="12.4%" trend="up"></lc-stat>
        <lc-stat title="Unfollows" value="312" delta="3.1%" trend="down"></lc-stat>
        <lc-stat title="Saves" value="1,024" delta="0%"></lc-stat>
      `,
    },
    {
      title: "Centered",
      render: () => html`
        <lc-join>
          <lc-stat title="Passed" value="85" variant="success" centered></lc-stat>
          <lc-stat title="Failed" value="3" variant="danger" centered></lc-stat>
          <lc-stat title="Pending" value="12" variant="warning" centered></lc-stat>
        </lc-join>
      `,
    },
  ],
};
