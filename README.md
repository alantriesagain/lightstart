# light

Light is an engine for user interfaces on the web, in the terminal and on the desktop. A view is a standard custom element rendered into the light DOM, built from signals and a tagged-template renderer. Models hold data, controllers hold shared state, and a theme supplies tokens and utility classes. The same view code runs in a browser, under prerendering, and natively through [scriptc](https://github.com/vercel-labs/scriptc), which compiles the terminal and desktop hosts to binaries with no JavaScript engine inside.

The idea is one engine across hosts, in small parts: the engine, then packages beside it for components, routing, serving, building. The engine has no runtime dependencies and no virtual DOM.

## Start a project

```bash
light new web my-app
cd my-app
pnpm dev
```

| Kind | What it starts |
|---|---|
| `web` | A page of light views and `lc-*` components |
| `tui` | A terminal app, with a model, a controller and views |
| `desktop` | A light page in a desktop shell, with a native backend |
| `package` | A light package, with modules, tests and a README |

The first script is `pnpm dev` for a web, tui or desktop project, and `pnpm test` for a package. Each project carries its own `README.md` and `AGENTS.md`.

Light's packages are not on npm yet, so `light new` links a light checkout: the one it runs from, or the one `--light <path>` names. To get `light` on PATH from a checkout, link its binary:

```bash
ln -s "$PWD/packages/cli/bin/light.js" ~/.local/bin/light
```

`--npm` writes published version ranges instead, so a project can switch over once the packages are on npm.

## What light is made of

The engine is [`@lightstart/light`](packages/light/README.md): views, the `html` renderer, signals, controllers, models, the theme, and the native hosts for the terminal and desktop. It is the reference for everything below.

| Package | What it is |
|---|---|
| [`@lightstart/components`](packages/components/README.md) | The `lc-*` component library, with its mixins, libs and stylesheets |
| [`@lightstart/router`](packages/router/README.md) | A client router with route patterns, a navigation stack, locales and base paths |
| [`@lightstart/markdown`](packages/markdown/README.md) | One Markdown parser, shared by the terminal renderer and `<lc-markdown>` |
| [`@lightstart/highlight`](packages/highlight/README.md) | Syntax coloring for terminal views and `<lc-code-block>` |
| [`@lightstart/server`](packages/server/README.md) | A small HTTP server over one `Context` and `Reply`, on node, Fetch hosts and Lambda |
| [`@lightstart/sqlite`](packages/sqlite/README.md) | One synchronous SQLite driver over node's engine or a native shim |
| [`@lightstart/cli`](packages/cli/README.md) | The command runner behind `light`, with commands, hooks, routes and extensions |
| [`@lightstart/dev`](packages/dev/README.md) | The dev server behind `light serve`, with the importmap, TypeScript stripping and live reload |
| [`@lightstart/build`](packages/build/README.md) | The production build behind `light build`, bundling pages and stylesheets with esbuild |
| [`@lightstart/create`](packages/create/README.md) | The generator behind `light new` |

## The light command

| Command | Does |
|---|---|
| `light new <kind> <name>` | Starts a project of a kind |
| `light serve` | Runs the dev server, reloading on a change |
| `light build` | Bundles a page into a production build |
| `light test` | Runs the tests, in a browser for a web app |
| `light check` | Checks the sources against light's conventions |
| `light desktop dev`, `light desktop build` | Runs a desktop app on the dev server, or builds it |

Packages extend the command set by shipping commands in their own `cli/` folders. See [the CLI README](packages/cli/README.md).

## Where this is going

An opt-in app layer, `@lightstart/app`, will tie views, models and controllers together and set a project's folders; `light new web` will start on it. The packages will be published to npm. Inside a project, there will be more generators, for a view, a model or a route.

## Working on light

Read [AGENTS.md](AGENTS.md) for the rules of this repository, and each package's own `AGENTS.md` where it has one.

| Folder | Holds |
|---|---|
| `packages/light/` | The engine |
| `packages/components/`, `packages/router/`, `packages/markdown/`, `packages/highlight/` | UI packages |
| `packages/server/`, `packages/sqlite/` | Server packages |
| `packages/cli/`, `packages/dev/`, `packages/build/`, `packages/create/` | Tooling |
| `packages/native/`, `packages/tui/` | Workspace packages that native apps share |
| `examples/` | Pages and apps on light alone |
| `benchmarks/` | The engine, renderer and server under node, natively and in Chromium |

## License

MIT
