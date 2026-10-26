---
name: friction-log
description: Record a framework stumble in the project's FRICTION.md the moment it happens
user_invocable: true
---

<!-- Managed by Bootstrapp: generated from bootstrapp/app/skills/friction-log.md. Edit the source, then run `bootstrapp types`. -->

# Log a friction entry

Every rough edge met while building `light-website` is written down as it happens, in `FRICTION.md` at the project root. Each entry is a framework fix candidate; it is marked CLOSED when the fix lands.

## Entry shape

```md
## <n>. <One line naming the friction> (`<category>`)

Expected: what the docs, the scaffold or the last step led you to expect.
Happened: what actually happened, with the exact message when there was one.
What we did: the workaround, in one sentence.
What the framework should do: the doc line, generator change, check rule,
component change or bug fix that removes the stumble.
Sonnet-class failure: how a smaller model would most likely have gone wrong here.
```

Categories: `docs`, `scaffold`, `cli`, `skill`, `check`, `components`, `mcp`, `bug`.

## Rules

- Log at the moment of the stumble, not at the end; the details are gone by then.
- Reading a sibling project or framework source because a doc did not say something is itself an entry.
- After each build step, add a checkpoint line with the `bootstrapp check` and `bootstrapp test` counts.
- Keep the file honest: an entry goes in only when the stumble was actually hit.
- Reference: `projects/bboxe/FRICTION.md`, `examples/centavo/FRICTION.md`.
