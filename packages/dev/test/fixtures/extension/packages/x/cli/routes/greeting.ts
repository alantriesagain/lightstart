import { App, text } from "@lightstart/server";
import type { RouteContext } from "@lightstart/dev";

export default (ctx: RouteContext & { greeting?: unknown }): App => new App().get("/route-greeting", () => text(String(ctx.greeting)));
