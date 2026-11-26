/**
 * @file @lightstart/notifications: one inbox out of an app's sources: the pure
 * feed, merge and seen-set helpers, the source slot, the controller, and the
 * views.
 */

export { filterFeed, parseFeed } from "./lib/feed.ts";
export { mergeInbox, NEWS_KEPT, NEWS_LIFE_MS, SEEN_KEPT, takeNew, unreadCount } from "./lib/inbox.ts";
export type { SeenState, TakenNew } from "./lib/inbox.ts";
export { notificationSources } from "./page/sources.ts";
export { default as notifications, notifications as notificationsController } from "./controllers/notifications.ts";
export type {
  Notification,
  NotificationFeed,
  NotificationRecord,
  NotificationSource,
  SourceContext,
} from "./types.ts";
