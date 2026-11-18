# @lightstart/showcase

light's component catalogue: the components of `@lightstart/components` by category, each one's props, examples, parts, slots and stylesheet, a live preview with a property editor, and the theme tools. An app embeds its views; the data comes from the components' `tags.json` and the `*.demo.js` beside each component, so a component added to the package shows up with no registration.

## The views

Each is imported by path and defines its tag (and the components it draws):

| Import | Tag | What |
|---|---|---|
| `@lightstart/showcase/views/catalogue.js` | `showcase-catalogue` | Every component by category, filtered by `search` and `category`, each with a preview of its first example |
| `@lightstart/showcase/views/component-doc.js` | `showcase-component-doc` | One component (`category`, `name`): its description, examples with their code, live props, parts, slots and stylesheet variables |
| `@lightstart/showcase/views/preview.js` | `showcase-preview` | One component's examples rendered, at a `viewportWidth`, in a `skin` |
| `@lightstart/showcase/views/property-editor.js` | `showcase-property-editor` | A form over a component's declared props, its `values` changing the previewed element |
| `@lightstart/showcase/views/sink.js` | `showcase-sink` | A sample of the components side by side, in a `skin` |
| `@lightstart/showcase/views/theme-editor.js` | `showcase-theme-editor` | A theme's tokens edited, with per-component overrides |
| `@lightstart/showcase/views/theme-generator.js` | `showcase-theme-generator` | A theme made from a few choices, applied live and exported |
| `@lightstart/showcase/views/css-editor.js` | `showcase-css-editor` | One component's stylesheet variables, overridden live |

A view that links to another page (a component's doc from the catalogue, an example's full preview) dispatches `showcase-open` with the target in `detail.uri`; the host navigates, through its router or otherwise.

```ts
import "@lightstart/showcase/views/catalogue.js";
import "@lightstart/showcase/views/component-doc.js";

html`<showcase-catalogue category="display" @showcase-open=${(e: CustomEvent<{ uri: string }>) => navigate(e.detail.uri)}></showcase-catalogue>`;
html`<showcase-component-doc category="display" name="button"></showcase-component-doc>`;
```

## The data

`@lightstart/showcase` itself exports what the views read, for a host that draws its own:

| Export | What |
|---|---|
| `componentTags()` | The components' tag table: tag to module, stylesheet, base and the tags it renders |
| `getComponentList(tags)`, `browsableCategories(tags, query?)`, `CATEGORIES`, `categoryById(id)`, `humanize(name)` | The components grouped by category, and the categories in order |
| `loadDemo(name)`, `loadComponent(name)` | A component's demo (description and examples) and its metadata (props, parts, slots), loaded once and counted as the page's work |
| `modulePath(name)`, `stylePath(name)` | A component's module and stylesheet specifiers |
| `describeComponent`, `getDefaultValues`, `extractDescription`, `extractParts`, `extractSlots`, `codeOf` | Reading a definition, its doc comment and an example's markup |
| `applySkin(name)`, `clearSkin(name)`, `skinScope(name)`, `SKIN_ATTRIBUTE` | A theme preset applied to one region of the page |
| `themeVariables(css, tag)`, `collectThemeTokens(...)`, `STARTER_THEME` | A stylesheet's variables, the tokens the components read, and the theme the generator starts from |

## Tests

```bash
light test @lightstart/showcase                                        # lib, under node and natively
node packages/light/bin/light.js test packages/showcase/views/*.browser.test.js   # the views, in Chromium
node --test packages/showcase/check/rules/*.test.js                    # the check rule
```
