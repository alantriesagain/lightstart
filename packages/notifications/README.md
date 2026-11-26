# @lightstart/notifications

One inbox out of however many sources an app has, the per-device state that
decides what is new, and the views that draw it.

## The mechanism, which is one thing

A source answers **what exists now**. It is never asked what is new, because
that is the reader's question and the answer is per device: the ids it has
already been shown, kept in local storage. An id it has never seen is a thing
that happened since it last looked.

That is the whole comparison. Nothing counts anything and nothing compares two
documents.

An id names a thing and **moves when that thing does**. A row keyed by a
database id alone announces itself once and then never again; one keyed by that
id plus what changed announces every change.

## Using it

The package exports a slot, `notificationSources`, from `@lightstart/app`'s
`defineSlot`. An app, or an extension it loads, fills it with one entry per
source:

```js
import { notificationSources, notifications } from "@lightstart/notifications";

const off = notificationSources.fill({
  id: "reminders",
  list: () => reminders.load(),
});
```

`list()` answers a `NotificationRecord[]`, or a promise of one. `retain: true`
puts that source's rows through the seen set and keeps what was new, for a
source that only carries what is still live: a status that ends stops being
answered, and without `retain` the line would vanish out of the inbox under
somebody still reading it.

`fill` answers a function that takes the source back out again. Withdrawing a
plain source drops its lines on the next refresh; a retained line stays until
it is two days old.

The controller is `defineController({ name: "notifications" })`; an app starts
it like any other controller, or an extension lists it in `controllers`. Its
state is available to views with `sync: notifications`.

## The controller

| | |
|---|---|
| `inbox` | every line, newest first, each marked `read` |
| `unread` | how many are not |
| `arrived` | the unread lines the last refresh that found any had never shown this device, newest first; empty on a device's first look |
| `pending` | a refresh is in flight |
| `refresh(force?)` | ask every source again; coalesced: callers landing during a run share the one run after it |
| `markRead(id)` / `markAllRead()` / `isRead(id)` | per device, stored |

It refreshes on start, when the slot changes, and when the tab becomes visible.
A source that throws contributes nothing and takes nobody else down.

Read state and seen ids are per device, deliberately: reading something in a
browser does not undo the phone having buzzed about it.

`arrived` is for a host that says so as it happens: subscribe with
`notifications.$state.subscribe("arrived", rows => ...)` and raise a toast.
Only a `retain` source's lines can arrive, since a plain source answers what
exists rather than what happened, and it is set only when a refresh found
something, so every change is news.

## The views

Every one composes `@lightstart/light` and none of them decides where the inbox
lives. They import the controller handle; no `$APP`.

| Tag | Props | Emits |
|---|---|---|
| `notifications-bell` | `unread` (synced), `glass`, `icon` (`bell`), `iconSize` | `open` |
| `notifications-list` | `inbox`, `unread` (synced), `readAll` | `select {id, url}` |
| `notifications-row` | `item` | `select {id, url}` |
| `notifications-sheet` | `open` | `sheet-closed` |

The bell carries the unread count on its corner, up to 9 and then `9+`, and its
label says the number (`--notifications-bell-count-*` size and place it). It
draws a bell unless the host names another glyph through `icon` (`inbox`, say);
the label is the inbox's whichever it draws. It opens nothing by itself: it asks
its host to, so an app can answer with a sheet, a drawer or a route. The sheet
is `lc-bottom-sheet`'s modal form: nothing of it shows while closed, it takes
the inbox's height up to 80dvh (`--notifications-sheet-max-height`), and a host
styles it through the sheet's own variables set on `notifications-sheet`,
`--lc-bottom-sheet-z-index` above its own bars included. The list marks a line
read on the way out, so a host's handler sees it already read, and navigation
rides `lc-list-row`'s own `href`.

Words come from `locales/<lang>.js` under the `notifications-*` tag keys, merged
beneath the project's own file, and fall back to this package's English when the
host has no translations.

## The wire contract

A feed is either a bare list or an envelope naming it:

```json
[ { "id": "...", "title": "...", "body": "...", "url": "/x", "createdAt": "..." } ]
{ "notifications": [ ... ] }
```

| field | |
|---|---|
| `id` | required, non-empty, stable while the thing is unchanged; a row without one is dropped |
| `title`, `body`, `url` | what a reader sees and where a tap lands |
| `icon`, `type`, `community`, `createdAt` | drawn, grouped, filtered, ordered |
| `expiresAt` | optional ISO deadline; an expired row is not shown |

`parseFeed` accepts both shapes and `filterFeed` drops expired rows and, when
the app runs as a community, other communities' rows.

## Not ported

The account's own feed, and the credential a native shell's background poll
once read it with, stay outside this package: the feed belongs to the app's
server and the shell is not part of light. There is no `server/` contribution
here, and no manifest key. Wire an app's feed as an ordinary source.

## Testing

```bash
light test @lightstart/notifications
light test test/notifications.browser.test.js
light test test/views.browser.test.js
```

The pure half (`lib/feed.ts` and `lib/inbox.ts`) runs under node. The
controller and the views run in headless Chromium. A browser test keeps one
controller for the file and resets its state between cases rather than
disposing it while views are bound to it.
