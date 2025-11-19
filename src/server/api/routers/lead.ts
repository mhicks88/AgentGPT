/**
 * Lead Router
 *
 * tRPC router for lead management operations.
 * All procedures are tenant-scoped for data isolation.
 */

import { z } from "zod";
import { LeadStatus, LeadSource } from "@prisma/client";
import { createTRPCRouter, tenantProcedure } from "../trpc";

/**
 * Validation schemas
 */
const createLeadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  dateOfBirth: z.date().optional(),
  assignedTo: z.string().optional(),
  source: z.nativeEnum(LeadSource),
  medicareNumber: z.string().optional(),
  isCurrentlyInsured: z.boolean().optional(),
  currentCarrier: z.string().optional(),
  phones: z.array(z.object({
    type: z.enum(["mobile", "home", "work"]),
    number: z.string(),
    isPrimary: z.boolean().optional(),
  })).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

const updateLeadSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  dateOfBirth: z.date().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  assignedTo: z.string().optional(),
  isDNC: z.boolean().optional(),
  dncReason: z.string().optional(),
  nextFollowUpAt: z.date().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

const leadFiltersSchema = z.object({
  status: z.array(z.nativeEnum(LeadStatus)).optional(),
  assignedTo: z.array(z.string()).optional(),
  source: z.array(z.nativeEnum(LeadSource)).optional(),
  isDNC: z.boolean().optional(),
  search: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
});

const paginationSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

/**
 * Lead Router
 */
export const leadRouter = createTRPCRouter({
  /**
   * Create a new lead
   */
  create: tenantProcedure
    .input(createLeadSchema)
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.services.lead.createLead(
        input,
        ctx.userId,
        ctx.tenantId
      );

      return lead;
    }),

  /**
   * Get lead by ID
   */
  getById: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const lead = await ctx.services.lead.getLeadById(
        input.id,
        ctx.tenantId
      );

      if (!lead) {
        throw new Error("Lead not found");
      }

      return lead;
    }),

  /**
   * List leads with filters and pagination
   */
  list: tenantProcedure
    .input(z.object({
      filters: leadFiltersSchema.optional(),
      pagination: paginationSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.services.lead.listLeads(
        input.filters || {},
        input.pagination || {},
        ctx.tenantId
      );
    }),

  /**
   * Update lead
   */
  update: tenantProcedure
    .input(z.object({
      id: z.string(),
      data: updateLeadSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.services.lead.updateLead(
        input.id,
        input.data,
        ctx.userId,
        ctx.tenantId
      );

      return lead;
    }),

  /**
   * Update lead status
   */
  updateStatus: tenantProcedure
    .input(z.object({
      id: z.string(),
      status: z.nativeEnum(LeadStatus),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.lead.updateStatus(
        input.id,
        input.status,
        ctx.userId,
        ctx.tenantId
      );
    }),

  /**
   * Assign lead to agent
   */
  assign: tenantProcedure
    .input(z.object({
      leadId: z.string(),
      agentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.lead.assignLead(
        input.leadId,
        input.agentId,
        ctx.userId,
        ctx.tenantId
      );
    }),

  /**
   * Mark lead as Do Not Contact
   */
  markAsDNC: tenantProcedure
    .input(z.object({
      leadId: z.string(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.lead.markAsDNC(
        input.leadId,
        input.reason,
        ctx.userId,
        ctx.tenantId
      );
    }),

  /**
   * Remove DNC status
   */
  removeDNC: tenantProcedure
    .input(z.object({
      leadId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.lead.removeDNC(
        input.leadId,
        ctx.userId,
        ctx.tenantId
      );
    }),

  /**
   * Get my assigned leads
   */
  myLeads: tenantProcedure
    .input(z.object({
      status: z.array(z.nativeEnum(LeadStatus)).optional(),
      pagination: paginationSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.services.lead.listLeads(
        {
          assignedTo: [ctx.userId],
          status: input.status,
        },
        input.pagination || {},
        ctx.tenantId
      );
    }),

  /**
   * Get lead activity timeline
   */
  getActivityTimeline: tenantProcedure
    .input(z.object({
      leadId: z.string(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const activities = await ctx.prisma.activity.findMany({
        where: {
          leadId: input.leadId,
          tenantId: ctx.tenantId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit || 50,
      });

      return activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        description: activity.description,
        metadata: activity.metadata,
        userId: activity.userId,
        userName: activity.user?.name,
        createdAt: activity.createdAt,
      }));
    }),

  /**
   * Get lead notes
   */
  getNotes: tenantProcedure
    .input(z.object({ leadId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.services.note.getLeadNotes(
        input.leadId,
        ctx.tenantId
      );
    }),

  /**
   * Get lead tasks
   */
  getTasks: tenantProcedure
    .input(z.object({ leadId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.services.task.listTasks(
        { leadId: input.leadId },
        { limit: 100 },
        ctx.tenantId
      );

      return result.data;
    }),

  /**
   * Get lead calls
   */
  getCalls: tenantProcedure
    .input(z.object({
      leadId: z.string(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.call.findMany({
        where: {
          leadId: input.leadId,
          tenantId: ctx.tenantId,
        },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
          recording: true,
        },
        orderBy: {
          initiatedAt: 'desc',
        },
        take: input.limit || 20,
      });
    }),
});
