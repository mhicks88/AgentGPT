/**
 * Lead Service
 *
 * Business logic for lead management including CRUD operations,
 * assignment, status updates, and activity tracking.
 */

import type { PrismaClient, Lead, LeadStatus } from '@prisma/client';
import type {
  CreateLeadInput,
  UpdateLeadInput,
  LeadFilters,
  LeadWithDetails,
  PaginationParams,
  PaginatedResponse,
} from '@/types';
import { AuditLogger } from '../audit';

export class LeadService {
  private auditLogger: AuditLogger;

  constructor(private prisma: PrismaClient) {
    this.auditLogger = new AuditLogger(prisma);
  }

  /**
   * Create a new lead
   */
  async createLead(
    input: CreateLeadInput,
    createdBy: string,
    tenantId: string
  ): Promise<Lead> {
    const lead = await this.prisma.lead.create({
      data: {
        tenantId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        dateOfBirth: input.dateOfBirth,
        assignedTo: input.assignedTo,
        createdBy,
        source: input.source,
        medicareNumber: input.medicareNumber,
        isCurrentlyInsured: input.isCurrentlyInsured,
        currentCarrier: input.currentCarrier,
        tags: input.tags?.join(','),
        customFields: input.customFields,
        // Create contact info
        contactInfo: input.phones
          ? {
              createMany: {
                data: input.phones.map((phone) => ({
                  type: phone.type,
                  value: phone.number,
                  isPrimary: phone.isPrimary || false,
                  isMobile: phone.type === 'mobile',
                })),
              },
            }
          : undefined,
      },
      include: {
        contactInfo: true,
      },
    });

    // Log creation
    await this.auditLogger.logCreate('Lead', lead.id, lead as any, {
      userId: createdBy,
      tenantId,
      metadata: {
        source: input.source,
      },
    });

    // Create activity
    await this.prisma.activity.create({
      data: {
        tenantId,
        leadId: lead.id,
        userId: createdBy,
        type: 'lead_created',
        description: `Lead created from source: ${input.source}`,
        metadata: {
          source: input.source,
        },
      },
    });

    return lead;
  }

  /**
   * Get lead by ID with details
   */
  async getLeadById(
    leadId: string,
    tenantId: string
  ): Promise<LeadWithDetails | null> {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId,
      },
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contactInfo: {
          where: { isPrimary: true },
        },
        soa: true,
        _count: {
          select: {
            calls: true,
            notes: true,
            tasks: true,
          },
        },
      },
    });

    if (!lead) {
      return null;
    }

    return this.mapToLeadWithDetails(lead);
  }

  /**
   * Update lead
   */
  async updateLead(
    leadId: string,
    input: UpdateLeadInput,
    updatedBy: string,
    tenantId: string
  ): Promise<Lead> {
    // Get current state for audit log
    const before = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!before) {
      throw new Error('Lead not found');
    }

    const lead = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        dateOfBirth: input.dateOfBirth,
        status: input.status,
        assignedTo: input.assignedTo,
        isDNC: input.isDNC,
        dncReason: input.dncReason,
        dncDate: input.isDNC ? new Date() : undefined,
        nextFollowUpAt: input.nextFollowUpAt,
        tags: input.tags?.join(','),
        customFields: input.customFields,
      },
    });

    // Log update
    await this.auditLogger.logUpdate('Lead', leadId, before as any, lead as any, {
      userId: updatedBy,
      tenantId,
    });

    // Create activities for significant changes
    if (input.status && input.status !== before.status) {
      await this.prisma.activity.create({
        data: {
          tenantId,
          leadId,
          userId: updatedBy,
          type: 'status_changed',
          description: `Status changed from ${before.status} to ${input.status}`,
          metadata: {
            oldStatus: before.status,
            newStatus: input.status,
          },
        },
      });
    }

    if (input.assignedTo && input.assignedTo !== before.assignedTo) {
      await this.prisma.activity.create({
        data: {
          tenantId,
          leadId,
          userId: updatedBy,
          type: 'lead_assigned',
          description: `Lead assigned to new agent`,
          metadata: {
            previousAgent: before.assignedTo,
            newAgent: input.assignedTo,
          },
        },
      });
    }

    return lead;
  }

  /**
   * List leads with filters and pagination
   */
  async listLeads(
    filters: LeadFilters,
    pagination: PaginationParams,
    tenantId: string
  ): Promise<PaginatedResponse<LeadWithDetails>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenantId,
      ...(filters.status && { status: { in: filters.status } }),
      ...(filters.assignedTo && { assignedTo: { in: filters.assignedTo } }),
      ...(filters.source && { source: { in: filters.source } }),
      ...(filters.isDNC !== undefined && { isDNC: filters.isDNC }),
      ...(filters.search && {
        OR: [
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
          { email: { contains: filters.search } },
        ],
      }),
      ...(filters.createdAfter && {
        createdAt: { gte: filters.createdAfter },
      }),
      ...(filters.createdBefore && {
        createdAt: { lte: filters.createdBefore },
      }),
    };

    // Get total count
    const total = await this.prisma.lead.count({ where });

    // Get leads
    const leads = await this.prisma.lead.findMany({
      where,
      skip,
      take: limit,
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contactInfo: {
          where: { isPrimary: true },
        },
        soa: true,
        _count: {
          select: {
            calls: true,
            notes: true,
            tasks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      data: leads.map(this.mapToLeadWithDetails),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + leads.length < total,
      },
    };
  }

  /**
   * Mark lead as DNC (Do Not Contact)
   */
  async markAsDNC(
    leadId: string,
    reason: string,
    userId: string,
    tenantId: string
  ): Promise<Lead> {
    const lead = await this.updateLead(
      leadId,
      {
        isDNC: true,
        dncReason: reason,
      },
      userId,
      tenantId
    );

    // Create activity
    await this.prisma.activity.create({
      data: {
        tenantId,
        leadId,
        userId,
        type: 'status_changed',
        description: `Lead marked as Do Not Contact: ${reason}`,
        metadata: {
          reason,
        },
      },
    });

    return lead;
  }

  /**
   * Remove DNC status
   */
  async removeDNC(
    leadId: string,
    userId: string,
    tenantId: string
  ): Promise<Lead> {
    return this.updateLead(
      leadId,
      {
        isDNC: false,
        dncReason: undefined,
      },
      userId,
      tenantId
    );
  }

  /**
   * Update lead status
   */
  async updateStatus(
    leadId: string,
    status: LeadStatus,
    userId: string,
    tenantId: string
  ): Promise<Lead> {
    return this.updateLead(leadId, { status }, userId, tenantId);
  }

  /**
   * Assign lead to agent
   */
  async assignLead(
    leadId: string,
    agentId: string,
    userId: string,
    tenantId: string
  ): Promise<Lead> {
    return this.updateLead(leadId, { assignedTo: agentId }, userId, tenantId);
  }

  /**
   * Map Prisma lead to LeadWithDetails
   */
  private mapToLeadWithDetails(lead: any): LeadWithDetails {
    const primaryPhone = lead.contactInfo?.find(
      (c: any) => c.type === 'phone' && c.isPrimary
    );
    const primaryEmail = lead.contactInfo?.find(
      (c: any) => c.type === 'email' && c.isPrimary
    );

    return {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      fullName: `${lead.firstName} ${lead.lastName}`,
      email: lead.email,
      status: lead.status,
      source: lead.source,
      isDNC: lead.isDNC,
      assignedAgent: lead.assignedAgent,
      primaryPhone: primaryPhone?.value,
      primaryEmail: primaryEmail?.value || lead.email,
      callCount: lead._count?.calls || 0,
      noteCount: lead._count?.notes || 0,
      taskCount: lead._count?.tasks || 0,
      soaStatus: lead.soa?.status,
      lastContactedAt: lead.lastContactedAt,
      nextFollowUpAt: lead.nextFollowUpAt,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }
}
