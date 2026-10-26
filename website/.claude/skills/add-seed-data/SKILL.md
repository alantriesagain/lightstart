---
name: add-seed-data
description: Seed a project's models with demo rows or reference data through models/seed.js
user_invocable: true
---

<!-- Managed by Bootstrapp: generated from bootstrapp/model/skills/add-seed-data.md. Edit the source, then run `bootstrapp types`. -->

# Add seed data

Two kinds of rows share `models/seed.js`, and they ship differently:

- **Demo rows** (a few realistic records to develop against) load in dev only.
- **Reference data** (a catalog the app needs to work: techniques, workouts, categories) must ship: set `bootstrapp.build.seed: true` in `package.json` and keep the demo rows out of production with a guard.

## Steps

1. **Read `models/schema.js`** for the fields, required flags and relations.
2. **Author reference data as pure code** in `lib/<catalog>.js` with a node test (`lib/<catalog>.test.js`) for its invariants (unique ids, references that resolve), and import it into the seed.
3. **Write `models/seed.js`**: one default export keyed by model name (`model/seed-default-export` enforces it).
4. **Load it**: seeds load once, on a fresh database. After editing the seed, bump `bootstrapp.database.version` or clear site data for the dev origin.

## Seed file shape

```js
import { TECHNIQUES } from "/lib/catalog.js";
import $APP from "bootstrapp";

const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();

const session = [
  { id: "seed-session-1", startedAt: ago(1), completedAt: ago(1), dayKey: ago(1).slice(0, 10), rounds: 3 },
];

export default { technique: TECHNIQUES, session: $APP.manifest.production ? [] : session };
```

## Rules

- Explicit string ids, deterministic (`seed-<model>-<n>`), so relations can reference them and reruns do not duplicate.
- Respect `required` fields and enums; dates as ISO strings computed from `new Date()` so a deploy's seeds stay recent.
- No `Math.random`; a seeded generator when variety is wanted (`examples/centavo/models/seed.js`).
- Reference: `projects/bboxe/models/seed.js` (reference data plus guarded demo sessions), `examples/centavo/models/seed.js` (demo rows).
