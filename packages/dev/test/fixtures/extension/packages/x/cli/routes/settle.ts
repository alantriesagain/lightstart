import { App, text } from "@lightstart/server";

let written = "";

export default (): App =>
  new App()
    .get("/settle-write", (c) => {
      c.waitUntil(new Promise<void>((resolve) => setTimeout(() => { written = "done"; resolve(); }, 50)));
      return text("queued");
    })
    .get("/settle-read", () => text(written));
