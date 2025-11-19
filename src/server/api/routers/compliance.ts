/**
 * Compliance Router
 *
 * tRPC router for compliance operations including pre-call checks,
 * in-call scripts, post-call validation, and SOA management.
 */

import { z } from "zod";
import { SOAStatus } from "@prisma/client";
import { createTRPCRouter, tenantProcedure, adminProcedure } from "../trpc";

/**
 * Compliance Router
 */
export const complianceRouter = createTRPCRouter({
  /**
   * Run pre-call compliance check
   * CRITICAL: Must be called before initiating any call
   */
  preCallCheck: tenantProcedure
    .input(z.object({
      leadId: z.string(),
      intendedProducts: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.compliance.runPreCallCheck(
        {
          leadId: input.leadId,
          agentId: ctx.userId,
          intendedProducts: input.intendedProducts,
        },
        ctx.tenantId
      );
    }),

  /**
   * Get in-call script and guidance
   */
  getCallScript: tenantProcedure
    .input(z.object({
      callId: z.string(),
      leadId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.services.compliance.generateCallScript(
        input.callId,
        input.leadId,
        ctx.tenantId
      );
    }),

  /**
   * Submit post-call compliance data
   */
  postCallSubmit: tenantProcedure
    .input(z.object({
      callId: z.string(),
      disclaimersRead: z.array(z.string()),
      soaCaptured: z.boolean().optional(),
      soaDetails: z.object({
        productsDiscussed: z.array(z.string()),
        captureMethod: z.enum(['Electronic', 'Verbal', 'Physical Form']),
        documentUrl: z.string().optional(),
      }).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.compliance.runPostCallCheck(
        input,
        ctx.tenantId,
        ctx.userId
      );
    }),

  /**
   * SOA Management
   */
  soa: createTRPCRouter({
    /**
     * Create SOA for a lead
     */
    create: tenantProcedure
      .input(z.object({
        leadId: z.string(),
        productsDiscussed: z.array(z.string()),
        captureMethod: z.enum(['Electronic', 'Verbal', 'Physical Form']),
        documentUrl: z.string().optional(),
        ipAddress: z.string().optional(),
        userAgent: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.soa.createSOA(
          input,
          ctx.userId,
          ctx.tenantId
        );
      }),

    /**
     * Update SOA
     */
    update: tenantProcedure
      .input(z.object({
        id: z.string(),
        data: z.object({
          status: z.nativeEnum(SOAStatus).optional(),
          productsDiscussed: z.string().optional(),
          signedAt: z.date().optional(),
          expiresAt: z.date().optional(),
          revokedAt: z.date().optional(),
          notes: z.string().optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.soa.updateSOA(
          input.id,
          input.data,
          ctx.tenantId
        );
      }),

    /**
     * Get SOA for a lead
     */
    getByLead: tenantProcedure
      .input(z.object({ leadId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.soa.getSOAByLeadId(input.leadId);
      }),

    /**
     * Mark SOA as signed
     */
    markAsSigned: tenantProcedure
      .input(z.object({
        id: z.string(),
        documentUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.soa.markAsSigned(
          input.id,
          input.documentUrl
        );
      }),

    /**
     * Revoke SOA
     */
    revoke: tenantProcedure
      .input(z.object({
        id: z.string(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.soa.revokeSOA(
          input.id,
          input.reason
        );
      }),

    /**
     * Get expiring SOAs
     */
    expiringSoon: tenantProcedure
      .input(z.object({ daysThreshold: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.soa.getExpiringSoonSOAs(
          ctx.tenantId,
          input.daysThreshold
        );
      }),

    /**
     * Check if SOA is valid for products
     */
    checkValidity: tenantProcedure
      .input(z.object({
        leadId: z.string(),
        products: z.array(z.string()),
      }))
      .query(async ({ ctx, input }) => {
        const isValid = await ctx.services.soa.isSOAValidForProducts(
          input.leadId,
          input.products
        );

        return { isValid };
      }),
  }),

  /**
   * Get compliance check history
   */
  getCheckHistory: tenantProcedure
    .input(z.object({
      leadId: z.string().optional(),
      callId: z.string().optional(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        tenantId: ctx.tenantId,
      };

      if (input.leadId) {
        where.leadId = input.leadId;
      }

      if (input.callId) {
        where.callId = input.callId;
      }

      return ctx.prisma.complianceCheckRun.findMany({
        where,
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          executedAt: 'desc',
        },
        take: input.limit || 20,
      });
    }),

  /**
   * Admin: Manage compliance rules
   */
  rules: createTRPCRouter({
    /**
     * List all rules
     */
    list: adminProcedure
      .query(async ({ ctx }) => {
        return ctx.prisma.complianceRule.findMany({
          where: {
            tenantId: ctx.tenantId,
          },
          orderBy: {
            priority: 'desc',
          },
        });
      }),

    /**
     * Create rule
     */
    create: adminProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        ruleType: z.string(),
        config: z.record(z.unknown()),
        isActive: z.boolean().optional(),
        isBlocking: z.boolean().optional(),
        priority: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.complianceRule.create({
          data: {
            tenantId: ctx.tenantId,
            name: input.name,
            description: input.description,
            ruleType: input.ruleType as any,
            config: input.config,
            isActive: input.isActive ?? true,
            isBlocking: input.isBlocking ?? true,
            priority: input.priority ?? 0,
            createdBy: ctx.userId,
          },
        });
      }),

    /**
     * Update rule
     */
    update: adminProcedure
      .input(z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          config: z.record(z.unknown()).optional(),
          isActive: z.boolean().optional(),
          isBlocking: z.boolean().optional(),
          priority: z.number().optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.complianceRule.update({
          where: { id: input.id },
          data: input.data,
        });
      }),

    /**
     * Delete rule
     */
    delete: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.prisma.complianceRule.delete({
          where: { id: input.id },
        });

        return { success: true };
      }),
  }),

  /**
   * Admin: Manage disclaimer templates
   */
  disclaimers: createTRPCRouter({
    /**
     * List disclaimers
     */
    list: tenantProcedure
      .query(async ({ ctx }) => {
        return ctx.prisma.disclaimerTemplate.findMany({
          where: {
            tenantId: ctx.tenantId,
          },
          orderBy: {
            isRequired: 'desc',
          },
        });
      }),

    /**
     * Create disclaimer
     */
    create: adminProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        text: z.string(),
        isRequired: z.boolean().optional(),
        appliesTo: z.object({
          productTypes: z.array(z.string()).optional(),
          states: z.array(z.string()).optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.disclaimerTemplate.create({
          data: {
            tenantId: ctx.tenantId,
            name: input.name,
            description: input.description,
            text: input.text,
            isRequired: input.isRequired ?? true,
            appliesTo: input.appliesTo,
          },
        });
      }),

    /**
     * Update disclaimer
     */
    update: adminProcedure
      .input(z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          text: z.string().optional(),
          isRequired: z.boolean().optional(),
          appliesTo: z.record(z.unknown()).optional(),
          isActive: z.boolean().optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.disclaimerTemplate.update({
          where: { id: input.id },
          data: input.data,
        });
      }),

    /**
     * Delete disclaimer
     */
    delete: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.prisma.disclaimerTemplate.delete({
          where: { id: input.id },
        });

        return { success: true };
      }),
  }),
});
