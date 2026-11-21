import { defineWorker } from "@lightstart/app/web/worker-entry";
import { modelChanged } from "@lightstart/light/model/events";
import { archived, lastArchived } from "./shared.js";

let store = null;
let greeting = "";

export default defineWorker({
  serve: {
    "archive.total": () => (store === null ? 0 : store.count("archive")),
    "worker.greeting": () => greeting,
  },
  relay: { archived },
  mirror: { lastArchived: { signal: lastArchived, owner: true } },
  async opened(context) {
    store = context.store;
    modelChanged.on((change) => {
      if (change.model !== "archive" || change.row === undefined) return;
      if (change.action !== "add" && change.action !== "sync") return;
      archived.emit(change.row);
      lastArchived.value = change.row.text;
    });
    greeting = await context.request("page.hello", { from: "worker" });
  },
});
