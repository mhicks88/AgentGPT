/**
 * Note Router
 *
 * tRPC router for note management operations.
 */

import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../trpc";

/**
 * Note Router
 */
export const noteRouter = createTRPCRouter({
  /**
   * Create a note
   */
  create: tenantProcedure
    .input(z.object({
      leadId: z.string(),
      content: z.string().min(1),
      isPinned: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.note.createNote(
        input,
        ctx.userId,
        ctx.tenantId
      );
    }),

  /**
   * Update note
   */
  update: tenantProcedure
    .input(z.object({
      id: z.string(),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.note.updateNote(
        input.id,
        input.content,
        ctx.userId,
        ctx.tenantId
      );
    }),

  /**
   * Toggle pin status
   */
  togglePin: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.note.togglePin(
        input.id,
        ctx.userId,
        ctx.tenantId
      );
    }),

  /**
   * Delete note
   */
  delete: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.note.deleteNote(
        input.id,
        ctx.userId,
        ctx.tenantId
      );

      return { success: true };
    }),

  /**
   * Get notes for a lead
   */
  getByLead: tenantProcedure
    .input(z.object({ leadId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.services.note.getLeadNotes(
        input.leadId,
        ctx.tenantId
      );
    }),
});
