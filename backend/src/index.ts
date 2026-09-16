import "./routes-account";
import "./routes-chat";
import "./routes-storage";
import "./routes-upload";
import { app } from "./backend-utils";
import { handleScheduledCleanup } from "./resource-limits";

app.get("/api/health", async (c) => {
  try {
    await c.env.D1_DB.prepare("SELECT 1").first();
    return c.json({ status: "ok" });
  } catch (error) {
    return c.json({ status: "error", error: "Health check failed." }, 500);
  }
});

export { ChatSessionDurableObject } from "./chat-session-durable-object";

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduledCleanup(env));
  }
};
