# light

Light-DOM web components from object definitions, with reactive properties, a tagged-template renderer, signals, property types, a theme engine and a component library, on the browser, the server and native targets. The package is `@bootstrapp/light`, in [packages/light](packages/light/README.md), with its documentation.

| Folder | What it holds |
|---|---|
| `packages/light/` | `@bootstrapp/light`: the view engine, the renderer, signals, controllers, models, the theme, the component library, the native hosts and the tools (`light check`, `light test`) ([README](packages/light/README.md)) |
| `packages/native/`, `packages/tui/` | The workspace packages native apps share, and `light-native`, their tooling ([README](packages/README.md)) |
| `examples/` | Pages and apps built on light alone; `examples/tasks` is the terminal reference app |
| `benchmarks/` | The benchmarks under node, natively and in Chromium ([README](benchmarks/README.md)) |
| `website/` | The catalogue site, a Bootstrapp app |

`pnpm install` once at the root. `pnpm verify` runs every gate and passes only at zero errors: the lint and the typecheck of the repository, `light check` over the root's files, the package's own `verify` (`packages/light`: its typechecks, `light check`, the node and browser tests, the native parity and coverage gates, the desktop smoke), the tasks example's coverage and baked classes, and the packages' gates. `pnpm test` runs the package's tests and `pnpm check` both checks; the package's other scripts run from `packages/light`. `npx light serve` serves the repository with the core's TypeScript stripped as it goes out; open `/examples/…`.

The Bootstrapp monorepo consumes this repository in place: its `light/` is a symlink to a checkout beside it, its workspace lists `light/packages/light`, and its `projects/light` links to `website/`.

## License

MIT
