/**
 * @file @lightstart/notifications: public type declarations.
 */

/**
 * One line in an inbox, and one item of a feed.
 *
 * `id` is the whole mechanism: it names a thing that exists, and it moves when
 * that thing does. A reader keeps the ids it has been shown, and whatever is
 * not in that set is what changed since it last looked. Nothing counts anything
 * and nothing compares two documents.
 */
export interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  body: string;
  icon: string;
  url: string;
  community: string;
  createdAt: string;
  expiresAt?: string;
  read?: boolean;
}

/** One line in an inbox, the name an app's sources answer with. */
export type Notification = NotificationRecord;

/** What a feed answers: the bare list, or an envelope naming it. */
export type NotificationFeed = NotificationRecord[] | { notifications: NotificationRecord[] };

/** What a source is handed when it is asked for its rows. */
export interface SourceContext {
  force: boolean;
  now: number;
}

/**
 * One place an app's lines come from, filled into `notificationSources`.
 *
 * `list` answers what exists now, not what is new. `retain` keeps a line after
 * the source stops answering it, through the device's seen set.
 */
export interface NotificationSource {
  id: string;
  list(context: SourceContext): NotificationRecord[] | Promise<NotificationRecord[]>;
  retain?: boolean;
}
