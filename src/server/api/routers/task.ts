/**
 * Task Router
 *
 * tRPC router for task management operations.
 */

import { z } from "zod";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { createTRPCRouter, tenantProcedure } from "../trpc";

/**
 * Validation schemas
 */
const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  leadId: z.string().optional(),
  assignedTo: z.string(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueAt: z.date().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueAt: z.date().optional(),
});

const taskFiltersSchema = z.object({
  status: z.array(z.nativeEnum(TaskStatus)).optional(),
  priority: z.array(z.nativeEnum(TaskPriority)).optional(),
  assignedTo: z.array(z.string()).optional(),
  leadId: z.string().optional(),
  dueAfter: z.date().optional(),
  dueBefore: z.date().optional(),
  isOverdue: z.boolean().optional(),
});

/**
 * Task Router
 */
export const taskRouter = createTRPCRouter({
  /**
   * Create a new task
   */
  create: tenantProcedure
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.services.task.createTask(
        input,
        ctx.userId,
        ctx.tenantId
      );
    }),

  /**
   * Update task
   */
  update: tenantProcedure
    .input(z.object({
      id: z.string(),
      data: updateTaskSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.task.updateTask(
        input.id,
        input.data,
        ctx.userId,
        ctx.tenantId
      );
    }),

  /**
   * Complete task
   */
  complete: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.task.completeTask(
        input.id,
        ctx.userId,
        ctx.tenantId
      );
    }),

  /**
   * Delete task
   */
  delete: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.task.deleteTask(
        input.id,
        ctx.userId,
        ctx.tenantId
      );

      return { success: true };
    }),

  /**
   * List tasks with filters
   */
  list: tenantProcedure
    .input(z.object({
      filters: taskFiltersSchema.optional(),
      pagination: z.object({
        page: z.number().optional(),
        limit: z.number().optional(),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.services.task.listTasks(
        input.filters || {},
        input.pagination || {},
        ctx.tenantId
      );
    }),

  /**
   * Get my tasks
   */
  myTasks: tenantProcedure
    .input(z.object({
      status: z.array(z.nativeEnum(TaskStatus)).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.services.task.getMyTasks(
        ctx.userId,
        ctx.tenantId,
        input.status
      );
    }),

  /**
   * Get overdue tasks
   */
  overdue: tenantProcedure
    .query(async ({ ctx }) => {
      return ctx.services.task.getOverdueTasks(
        ctx.userId,
        ctx.tenantId
      );
    }),

  /**
   * Get tasks due today
   */
  dueToday: tenantProcedure
    .query(async ({ ctx }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = await ctx.services.task.listTasks(
        {
          assignedTo: [ctx.userId],
          dueAfter: today,
          dueBefore: tomorrow,
          status: ['PENDING', 'IN_PROGRESS'],
        },
        { limit: 100 },
        ctx.tenantId
      );

      return result.data;
    }),
});
