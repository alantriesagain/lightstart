import { join } from "node:path";
import { defineExtension } from "@lightstart/cli";
import { App, text } from "@lightstart/server";
import { Cors } from "@lightstart/server/cors";

export default defineExtension("serve", {
  args: {
    greet: { flag: true, description: "Greet from the extension" },
  },
  setup(ctx, _args, api) {
    api.app.plugin(new Cors({ origins: ["https://allowed.example"] }));
    api.handle(new App().get("/handled", () => text("handled-app")));
    api.root("/vendor-x/", join(ctx.projectDir, "vendor"));
    api.page((_c, html) => '<!DOCTYPE html><html><head><title>ext</title></head><body><p>custom-shell</p>' + html + "</body></html>");
    api.watch(join(ctx.projectDir, "vendor"), "vendor-x");
    api.basePath("/base");
    api.payload.greeting = "hi-from-ext";
    const preview = process.env["EXT_PREVIEW_PORT"];
    if (preview !== undefined && preview !== "") api.preview(Number(preview));
  },
});
