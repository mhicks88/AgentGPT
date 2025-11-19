import { createTRPCRouter } from "./trpc";

// Legacy routers (from original AgentGPT)
import { exampleRouter } from "./routers/example";
import { chainRouter } from "./routers/chain";
import { agentRouter } from "./routers/agentRouter";
import { accountRouter } from "./routers/account";

// CRM routers
import { leadRouter } from "./routers/lead";
import { taskRouter } from "./routers/task";
import { noteRouter } from "./routers/note";
import { complianceRouter } from "./routers/compliance";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here
 */
export const appRouter = createTRPCRouter({
  // Legacy routers (from AgentGPT)
  example: exampleRouter,
  chain: chainRouter,
  agent: agentRouter,
  account: accountRouter,

  // CRM routers
  lead: leadRouter,
  task: taskRouter,
  note: noteRouter,
  compliance: complianceRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
