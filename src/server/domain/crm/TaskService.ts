/**
 * Task Service
 *
 * Manages tasks and follow-ups for leads and agents.
 */

import type { PrismaClient, Task, TaskStatus } from '@prisma/client';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  PaginationParams,
  PaginatedResponse,
} from '@/types';
import { AuditLogger } from '../audit';

export class TaskService {
  private auditLogger: AuditLogger;

  constructor(private prisma: PrismaClient) {
    this.auditLogger = new AuditLogger(prisma);
  }

  /**
   * Create a new task
   */
  async createTask(
    input: CreateTaskInput,
    createdBy: string,
    tenantId: string
  ): Promise<Task> {
    const task = await this.prisma.task.create({
      data: {
        tenantId,
        title: input.title,
        description: input.description,
        leadId: input.leadId,
        assignedTo: input.assignedTo,
        createdBy,
        priority: input.priority || 'MEDIUM',
        dueAt: input.dueAt,
      },
    });

    // Log creation
    await this.auditLogger.logCreate('Task', task.id, task as any, {
      userId: createdBy,
      tenantId,
    });

    // Create activity if linked to lead
    if (input.leadId) {
      await this.prisma.activity.create({
        data: {
          tenantId,
          leadId: input.leadId,
          userId: createdBy,
          type: 'task_created',
          description: `Task created: ${input.title}`,
          metadata: {
            taskId: task.id,
            dueAt: input.dueAt,
          },
        },
      });
    }

    return task;
  }

  /**
   * Update task
   */
  async updateTask(
    taskId: string,
    input: UpdateTaskInput,
    updatedBy: string,
    tenantId: string
  ): Promise<Task> {
    const before = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!before) {
      throw new Error('Task not found');
    }

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        dueAt: input.dueAt,
        completedAt: input.completedAt || (input.status === 'COMPLETED' ? new Date() : undefined),
      },
    });

    // Log update
    await this.auditLogger.logUpdate('Task', taskId, before as any, task as any, {
      userId: updatedBy,
      tenantId,
    });

    // Create activity if task completed
    if (input.status === 'COMPLETED' && before.status !== 'COMPLETED' && task.leadId) {
      await this.prisma.activity.create({
        data: {
          tenantId,
          leadId: task.leadId,
          userId: updatedBy,
          type: 'task_completed',
          description: `Task completed: ${task.title}`,
          metadata: {
            taskId: task.id,
          },
        },
      });
    }

    return task;
  }

  /**
   * Complete task
   */
  async completeTask(
    taskId: string,
    userId: string,
    tenantId: string
  ): Promise<Task> {
    return this.updateTask(
      taskId,
      {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      userId,
      tenantId
    );
  }

  /**
   * List tasks with filters
   */
  async listTasks(
    filters: TaskFilters,
    pagination: PaginationParams,
    tenantId: string
  ): Promise<PaginatedResponse<Task>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenantId,
      ...(filters.status && { status: { in: filters.status } }),
      ...(filters.priority && { priority: { in: filters.priority } }),
      ...(filters.assignedTo && { assignedTo: { in: filters.assignedTo } }),
      ...(filters.leadId && { leadId: filters.leadId }),
      ...(filters.dueAfter && { dueAt: { gte: filters.dueAfter } }),
      ...(filters.dueBefore && { dueAt: { lte: filters.dueBefore } }),
    };

    // Handle overdue filter
    if (filters.isOverdue) {
      where.dueAt = { lt: new Date() };
      where.status = { not: 'COMPLETED' };
    }

    const total = await this.prisma.task.count({ where });

    const tasks = await this.prisma.task.findMany({
      where,
      skip,
      take: limit,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        dueAt: 'asc',
      },
    });

    return {
      data: tasks as any,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + tasks.length < total,
      },
    };
  }

  /**
   * Get my tasks (for current user)
   */
  async getMyTasks(
    userId: string,
    tenantId: string,
    status?: TaskStatus[]
  ): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        tenantId,
        assignedTo: userId,
        ...(status && { status: { in: status } }),
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        dueAt: 'asc',
      },
    }) as any;
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(userId: string, tenantId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        tenantId,
        assignedTo: userId,
        dueAt: {
          lt: new Date(),
        },
        status: {
          not: 'COMPLETED',
        },
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        dueAt: 'asc',
      },
    }) as any;
  }

  /**
   * Delete task
   */
  async deleteTask(taskId: string, userId: string, tenantId: string): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    // Log deletion
    await this.auditLogger.logDelete('Task', taskId, task as any, {
      userId,
      tenantId,
    });
  }
}
