---
name: add-view
description: Create a project view component that composes light's components and dispatches to a controller
user_invocable: true
---

<!-- Managed by Bootstrapp: generated from bootstrapp/view/skills/add-view.md. Edit the source, then run `bootstrapp types`. -->

# Add a view

## Step 0: light's components first

Before writing any `docs-*` component, look for a light component to compose:

```bash
grep -rhoE 'tag:\s*"lc-[a-z-]+"' light/components
```

Views are thin: they render controller state and dispatch to controller methods. Never hand-roll a button, input, dialog, list row or stat.

## Steps

1. **Scaffold**: `bootstrapp new:view <kebab-name>` writes `views/<kebab-name>.js` (and a `.css` sibling when `bootstrapp.generator.styling` is `css`).
2. **Use the tag** anywhere: `<docs-<kebab-name>>`. Views auto-load by tag; never import or register one.
3. **Bind state** with `sync: "<controller>"` (property names must match the controller's) and call `$APP.<controller>.method()` on events.
4. **Add the route** if it is a screen: root `routes.js`, `component: "docs-<name>"`.

## Template

```js
import { html } from "@bootstrapp/light/html";
import $APP from "bootstrapp";
import T from "@bootstrapp/light/types";

export default {
  tag: "docs-task-list",
  props: {
    rows: T.array({ defaultValue: [], sync: "tasks" }),
    draft: "",
  },
  render() {
    return html`
      <lc-input .value=${this.draft} @input=${(e) => (this.draft = e.detail.value)}></lc-input>
      <lc-button primary icon="plus" @click=${() => $APP.tasks.add(this.draft)}>Add</lc-button>
      ${this.rows.map((row) => html`<lc-list-row label=${row.title} ?flat=${row.done}></lc-list-row>`)}
    `;
  },
};
```

## Rules

- Plain object literal; `defineComponent` from `@bootstrapp/light` only when typed `this` is wanted.
- `props` entries are reactive render state: a bare default (`draft: ""`, `open: false`, `rows: []`) or `T.*(options)` when an option is needed; mutate them, never `_vars` plus manual updates. Small persisted state is `T.*({ sync: "local" })` on a controller, not localStorage.
- A listener or subscription made in `connected()` is wrapped in `this.$own(...)`.
- Multi-word attributes are kebab-case (`use-system-preference`); a boolean prop (`open: false` or `T.boolean(...)`) binds as `?kebab-attr=${v}`, never `.prop=`.
- Framework members are `$`-prefixed (`$state`, `$emit`, `$own`, `$on`, `$off`, `$requestUpdate`, `$hasUpdated`, `$`, `$$`); a `$`-prefixed property or member is refused at define time, and so is a method named after a DOM method (`remove`, `append`, `click`, `focus`, `blur`, `closest`, `matches`): the view's methods land on the element's prototype. Every plain name is free, `state`, `connected`, `updated`, `ready` and `config` included; a property may share a lifecycle hook's name.
- Component events: `lc-switch` emits `change` with `e.detail.checked`; `lc-input`, `lc-select`, `lc-number-input`, `lc-segmented` emit `change` (and `input`) with `e.detail.value`.
- Internal links go through `<lc-link>`, `lc-button href`, `lc-list-row href`, or `$APP.Router.href(path)` on a bare anchor.
- Icons reached through a computed name go in the component's `icons: [...]` array.
- Tailwind styling: theme-token utilities only as static literals (a ternary between literals is fine); no `style: true`. CSS styling: a `.css` sibling scoped `:where(.tag, tag) { ... }` with theme vars.
- Reference: `projects/bboxe/views/`, `examples/centavo/views/`.
