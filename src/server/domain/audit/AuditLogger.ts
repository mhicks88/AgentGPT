/**
 * Audit Logger Service
 *
 * Handles all audit logging with immutable records for compliance.
 * Every important action in the CRM should be logged through this service.
 */

import type { PrismaClient } from '@prisma/client';
import { AuditAction } from '@prisma/client';
import type {
  CreateAuditLogInput,
  AuditMetadata,
  IAuditLogger,
  AuditLogWithDetails,
} from '@/types/audit';

export class AuditLogger implements IAuditLogger {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log any audit action
   */
  async log(input: CreateAuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before,
        after: input.after,
        metadata: input.metadata,
      },
    });
  }

  /**
   * Log entity creation
   */
  async logCreate(
    entityType: string,
    entityId: string,
    data: Record<string, unknown>,
    context?: {
      userId?: string;
      tenantId?: string;
      metadata?: AuditMetadata;
    }
  ): Promise<void> {
    await this.log({
      tenantId: context?.tenantId,
      userId: context?.userId,
      action: AuditAction.CREATE,
      entityType,
      entityId,
      after: data,
      metadata: context?.metadata,
    });
  }

  /**
   * Log entity update
   */
  async logUpdate(
    entityType: string,
    entityId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    context?: {
      userId?: string;
      tenantId?: string;
      metadata?: AuditMetadata;
    }
  ): Promise<void> {
    await this.log({
      tenantId: context?.tenantId,
      userId: context?.userId,
      action: AuditAction.UPDATE,
      entityType,
      entityId,
      before,
      after,
      metadata: context?.metadata,
    });
  }

  /**
   * Log entity deletion
   */
  async logDelete(
    entityType: string,
    entityId: string,
    data: Record<string, unknown>,
    context?: {
      userId?: string;
      tenantId?: string;
      metadata?: AuditMetadata;
    }
  ): Promise<void> {
    await this.log({
      tenantId: context?.tenantId,
      userId: context?.userId,
      action: AuditAction.DELETE,
      entityType,
      entityId,
      before: data,
      metadata: context?.metadata,
    });
  }

  /**
   * Get entity history
   */
  async getEntityHistory(
    entityType: string,
    entityId: string
  ): Promise<AuditLogWithDetails[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      userId: log.userId || undefined,
      userName: log.user?.name || undefined,
      userEmail: log.user?.email || undefined,
      tenantId: log.tenantId || undefined,
      tenantName: log.tenant?.name || undefined,
      before: log.before as Record<string, unknown> | undefined,
      after: log.after as Record<string, unknown> | undefined,
      metadata: log.metadata as AuditMetadata | undefined,
      createdAt: log.createdAt,
    }));
  }

  /**
   * Log compliance check
   */
  async logComplianceCheck(
    leadId: string,
    userId: string,
    tenantId: string,
    checkType: string,
    result: string,
    evidence: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: AuditAction.COMPLIANCE_CHECK,
      entityType: 'Lead',
      entityId: leadId,
      metadata: {
        checkType,
        result,
        evidence,
      },
    });
  }

  /**
   * Log SOA captured
   */
  async logSOACaptured(
    soaId: string,
    leadId: string,
    userId: string,
    tenantId: string,
    details: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: AuditAction.SOA_CAPTURED,
      entityType: 'SOA',
      entityId: soaId,
      after: details,
      metadata: {
        leadId,
      },
    });
  }

  /**
   * Log call initiated
   */
  async logCallInitiated(
    callId: string,
    leadId: string,
    userId: string,
    tenantId: string,
    phoneNumber: string
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: AuditAction.CALL_INITIATED,
      entityType: 'Call',
      entityId: callId,
      metadata: {
        leadId,
        phoneNumber,
      },
    });
  }

  /**
   * Log call completed
   */
  async logCallCompleted(
    callId: string,
    leadId: string,
    userId: string,
    tenantId: string,
    duration: number,
    outcome: string
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: AuditAction.CALL_COMPLETED,
      entityType: 'Call',
      entityId: callId,
      metadata: {
        leadId,
        duration,
        outcome,
      },
    });
  }
}
