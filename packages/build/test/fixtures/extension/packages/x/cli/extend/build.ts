import { defineExtension } from "@lightstart/cli";

export default defineExtension("build", {
  args: {
    banner: { default: "", description: "Text to put before every JavaScript output" },
    ssg: { flag: true, description: "Build as a static site" },
  },
  setup(_ctx, { banner, ssg }, api) {
    api.mode = ssg ? "ssg" : "spa";
    api.steps.after("modules", {
      name: "banner",
      run(ctx) {
        if (banner === "") return;
        for (const [path, content] of ctx.outputs) {
          if (!path.endsWith(".js")) continue;
          const text = typeof content === "string" ? content : new TextDecoder().decode(content);
          ctx.outputs.set(path, `${banner}\n${text}`);
        }
      },
    });
    api.steps.add({
      name: "mode",
      run(ctx) {
        ctx.outputs.set("mode.txt", ctx.mode);
      },
    });
  },
});
