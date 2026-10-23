import { html } from "@bootstrapp/light/html";

export default {
  description: "A flex row or column with the theme's spacing scale as its gap.",
  slot: () => html`
    <lc-button>Item 1</lc-button>
    <lc-button>Item 2</lc-button>
    <lc-button>Item 3</lc-button>
  `,
  preview: () => html`
    <lc-flex gap="sm" align="center">
      <lc-container variant="filled" padding="sm">One</lc-container>
      <lc-container variant="filled" padding="sm">Two</lc-container>
      <lc-container variant="filled" padding="sm">Three</lc-container>
    </lc-flex>
  `,
  examples: [
    {
      title: "Basic row layout",
      render: () => html`
        <lc-flex gap="md">
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </lc-flex>
      `,
    },
    {
      title: "Column layout with gap",
      render: () => html`
        <lc-flex direction="column" gap="lg">
          <div>Top</div>
          <div>Middle</div>
          <div>Bottom</div>
        </lc-flex>
      `,
    },
    {
      title: "Centered content",
      render: () => html`
        <lc-flex align="center" justify="center" style="min-height: 200px;">
          <div>Centered Content</div>
        </lc-flex>
      `,
    },
    {
      title: "Sidebar layout with -1",
      render: () => html`
        <lc-flex gap="md">
          <aside style="width: 250px;">
            Sidebar (fixed width)
          </aside>
          <main flex-1>
            Main content (takes remaining space)
          </main>
        </lc-flex>
      `,
    },
    {
      title: "Toolbar with flexible search",
      render: () => html`
        <lc-flex align="center" gap="sm">
          <lc-button flex-none>New</lc-button>
          <lc-button flex-none>Save</lc-button>
          <lc-input flex-1 placeholder="Search..."></lc-input>
          <lc-button flex-none variant="primary">Submit</lc-button>
        </lc-flex>
      `,
    },
    {
      title: "Card with flexible body",
      render: () => html`
        <lc-flex direction="column" gap="none" style="height: 400px;">
          <div flex-none style="padding: 1rem; border-bottom: 1px solid #ddd;">
            Header
          </div>
          <div flex-1 style="padding: 1rem; overflow-y: auto;">
            Body content that grows to fill available space
          </div>
          <div flex-none style="padding: 1rem; border-top: 1px solid #ddd;">
            Footer
          </div>
        </lc-flex>
      `,
    },
    {
      title: "Space between items",
      render: () => html`
        <lc-flex justify="space-between" align="center">
          <h2>Page Title</h2>
          <lc-button variant="primary">Action</lc-button>
        </lc-flex>
      `,
    },
    {
      title: "Individual item alignment",
      render: () => html`
        <lc-flex gap="md" style="height: 150px;">
          <div align-self="start">Aligned to start</div>
          <div align-self="center">Centered</div>
          <div align-self="end">Aligned to end</div>
          <div align-self="stretch">Stretched</div>
        </lc-flex>
      `,
    },
    {
      title: "Wrap items",
      render: () => html`
        <lc-flex wrap="wrap" gap="sm">
          <lc-badge>Tag 1</lc-badge>
          <lc-badge>Tag 2</lc-badge>
          <lc-badge>Tag 3</lc-badge>
          <lc-badge>Tag 4</lc-badge>
          <lc-badge>Tag 5</lc-badge>
        </lc-flex>
      `,
    },
    {
      title: "Dashboard layout",
      render: () => html`
        <lc-flex direction="column" gap="lg" style="height: 100vh;">
          <header flex-none>
            <lc-navbar>Navigation</lc-navbar>
          </header>

          <lc-flex flex-1 gap="md">
            <aside flex-none style="width: 300px;">
              <lc-sidebar>Sidebar</lc-sidebar>
            </aside>

            <main flex-1>
              <div style="padding: 2rem;">
                Main content area
              </div>
            </main>
          </lc-flex>

          <footer flex-none>
            Footer content
          </footer>
        </lc-flex>
      `,
    },
    {
      title: "Form row with labels",
      render: () => html`
        <lc-flex direction="column" gap="md">
          <lc-flex align="center" gap="sm">
            <label flex-none style="width: 120px;">Name:</label>
            <lc-input flex-1></lc-input>
          </lc-flex>

          <lc-flex align="center" gap="sm">
            <label flex-none style="width: 120px;">Email:</label>
            <lc-input flex-1 type="email"></lc-input>
          </lc-flex>
        </lc-flex>
      `,
    },
  ],
};
