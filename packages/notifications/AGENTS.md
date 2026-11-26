# Working on @lightstart/notifications

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The public surface: the pure helpers, the source slot, the controller and the types |
| `types.ts` | `NotificationRecord`, `Notification`, `NotificationFeed`, `NotificationSource`, `SourceContext` |
| `lib/feed.ts` | `parseFeed` and `filterFeed` |
| `lib/inbox.ts` | `takeNew`, `mergeInbox`, `unreadCount`, `SEEN_KEPT`, `NEWS_KEPT`, `NEWS_LIFE_MS` |
| `page/sources.ts` | `notificationSources`, the `notifications.sources` slot |
| `controllers/notifications.ts` | The `notifications` controller |
| `views/{bell,list,row,sheet}.js` | The four `notifications-*` tags |
| `views/{bell,sheet}.css` | Their styles, named by `tags.json` |
| `locales/{en,es,pt}.js` | The words the views draw, under the `notifications-*` tags |
| `tags.json` | The package's tag table, named by `package.json`'s `light.tags` |
| `test/` | Plain node scripts on `@lightstart/test/assert.ts` and two Chromium tests |

## Rules the sources keep

- `lib/` is pure: no DOM, no app, no controller. It reads a feed and decides what is new.
- A source is a slot item `{ id, list, retain? }`, never a registry attached to the controller. `list` answers what exists now, not what is new.
- Seen ids, read ids and held news stay per device through `sync: { to: "local" }`; an app registers the `local` adapter.
- The controller refreshes on start, on a slot change and on visibility, coalesces a forced run, and never lets a throwing source take the others down.
- Views import the controller handle and `lcText` with the English block from `locales/en.js`; no `$APP`, no hand-registered tags.
- TypeScript with erasable syntax; no `any`, in TS or JSDoc. Comments are a JSDoc module header and JSDoc on exports.
- Browser tests follow the package pattern: import the definitions and `View.define` them, name the controller, register the `local` adapter, and run one Chromium at a time.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `notificationSources` and the `{ id, list, retain? }` fill | an app or extension feeding the inbox |
| `notifications` and its props and methods (`inbox`, `unread`, `arrived`, `pending`, `refresh`, `markRead`, `markAllRead`, `isRead`) | an app's views and controllers |
| `parseFeed`, `filterFeed`, `takeNew`, `mergeInbox`, `unreadCount` and the constants | an app reading a feed or its own store |
| `tags.json`, the four tags and their props and events | the web generation and an app's views |
| The `notifications-*` locales | a page running `@lightstart/i18n` |

## Gates

From the repository root:

```bash
light typecheck @lightstart/notifications
light test @lightstart/notifications
```

From `packages/notifications`, one browser file per run:

```bash
light test test/notifications.browser.test.js
light test test/views.browser.test.js
```
