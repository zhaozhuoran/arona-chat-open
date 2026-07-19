import "./routes-account";
import "./routes-chat";
import "./routes-storage";
import "./routes-upload";
import { app } from "./backend-utils";
import { handleScheduledCleanup } from "./resource-limits";

export { ChatSessionDurableObject } from "./chat-session-durable-object";

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduledCleanup(env));
  }
};
