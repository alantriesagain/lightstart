/**
 * @file The routes: the open list's tasks, every list, and this run's activity. The root view's
 * `<app-outlet>` draws the one the path answers; F1, F2 and F3 go to them.
 */
export default {
  "/": { name: "tasks", title: "Tasks", view: "tasks-page" },
  "/lists": { name: "lists", title: "Lists", view: "lists-page" },
  "/activity": { name: "activity", title: "Activity", view: "activity-page" },
};
