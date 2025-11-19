/**
 * tRPC Configuration with Multi-Tenant Support
 *
 * Enhanced from T3 stack to include:
 * - Tenant isolation
 * - Domain services in context
 * - Role-based access control
 */

import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import { type Session } from "next-auth";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { getServerAuthSession } from "../auth";
import { prisma } from "../db/client";

// Import domain services
import { LeadService, TaskService, NoteService } from "../domain/crm";
import { ComplianceEngine, RuleEvaluator, SOAManager } from "../domain/compliance";
import { DialerFactory } from "../domain/dialer";
import { AuditLogger } from "../domain/audit";

/**
 * Extended session type with CRM-specific fields
 */
type CRMSession = Session & {
  user: {
    id: string;
    tenantId?: string;
    role?: string;
  };
};

/**
 * Context options
 */
type CreateContextOptions = {
  session: CRMSession | null;
  req?: any;
};

/**
 * Create inner tRPC context with all services
 */
const createInnerTRPCContext = (opts: CreateContextOptions) => {
  // Initialize services
  const auditLogger = new AuditLogger(prisma);
  const leadService = new LeadService(prisma);
  const taskService = new TaskService(prisma);
  const noteService = new NoteService(prisma);
  const soaManager = new SOAManager(prisma);
  const ruleEvaluator = new RuleEvaluator();
  const complianceEngine = new ComplianceEngine(prisma, ruleEvaluator, soaManager);

  return {
    session: opts.session,
    prisma,
    // Domain services
    services: {
      lead: leadService,
      task: taskService,
      note: noteService,
      compliance: complianceEngine,
      soa: soaManager,
      audit: auditLogger,
    },
    // Request metadata for audit logging
    req: opts.req,
  };
};

/**
 * Create tRPC context from Next.js request
 */
export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req, res } = opts;

  // Get session
  const session = (await getServerAuthSession({ req, res })) as CRMSession | null;

  // Get user's tenant from database if logged in
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true, role: true },
    });

    if (user) {
      session.user.tenantId = user.tenantId || undefined;
      session.user.role = user.role;
    }
  }

  return createInnerTRPCContext({
    session,
    req,
  });
};

/**
 * Initialize tRPC
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

/**
 * Export router and procedure helpers
 */
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

/**
 * Middleware: Enforce user authentication
 */
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      userId: ctx.session.user.id,
    },
  });
});

/**
 * Middleware: Enforce tenant membership
 * Ensures user has a tenant and adds tenantId to context
 */
const enforceTenantAccess = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const tenantId = ctx.session.user.tenantId;

  if (!tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User is not associated with any tenant/organization",
    });
  }

  // Verify tenant is active
  const tenant = await ctx.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { isActive: true },
  });

  if (!tenant || !tenant.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Organization is inactive",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.session.user.id,
      tenantId,
      userRole: ctx.session.user.role,
    },
  });
});

/**
 * Middleware: Enforce role-based access
 */
const enforceRole = (allowedRoles: string[]) => {
  return t.middleware(({ ctx, next }) => {
    const userRole = (ctx as any).userRole;

    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      });
    }

    return next();
  });
};

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

/**
 * Tenant procedure - requires authentication AND tenant membership
 * This is the most common procedure type for CRM operations
 */
export const tenantProcedure = t.procedure
  .use(enforceUserIsAuthed)
  .use(enforceTenantAccess);

/**
 * Admin procedure - requires ADMIN or SYSTEM_ADMIN role
 */
export const adminProcedure = tenantProcedure.use(
  enforceRole(["ADMIN", "SYSTEM_ADMIN"])
);

/**
 * Supervisor procedure - requires SUPERVISOR, ADMIN, or SYSTEM_ADMIN role
 */
export const supervisorProcedure = tenantProcedure.use(
  enforceRole(["SUPERVISOR", "ADMIN", "SYSTEM_ADMIN"])
);

/**
 * Type helper to extract context type
 */
export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
