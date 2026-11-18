/**
 * @file The routes: the open list's tasks, every list, and this page's activity. The root view's
 * `<app-container>` draws the one the path answers; the links in its nav go to them.
 */
export default {
  "/": { name: "tasks", title: "Tasks", view: "tasks-page" },
  "/lists": { name: "lists", title: "Lists", view: "lists-page" },
  "/activity": { name: "activity", title: "Activity", view: "activity-page" },
};
