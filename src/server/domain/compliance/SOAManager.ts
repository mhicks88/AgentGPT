/**
 * SOA (Scope of Appointment) Manager
 *
 * Handles creation, updating, and validation of Scope of Appointment records.
 * SOA is critical for Medicare compliance - agents must have a signed SOA before
 * discussing certain products with beneficiaries.
 */

import type { PrismaClient } from '@prisma/client';
import { SOAStatus } from '@prisma/client';
import type { CreateSOAInput, UpdateSOAInput, SOAWithDetails } from '@/types/compliance';

export class SOAManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new SOA for a lead
   */
  async createSOA(
    input: CreateSOAInput,
    createdBy: string,
    tenantId: string
  ): Promise<SOAWithDetails> {
    const { leadId, productsDiscussed, captureMethod, documentUrl, ipAddress, userAgent, notes } = input;

    // Check if lead already has an SOA
    const existingSOA = await this.prisma.sOA.findUnique({
      where: { leadId },
    });

    if (existingSOA) {
      // Update existing SOA instead
      return this.updateSOA(existingSOA.id, {
        productsDiscussed: productsDiscussed.join(', '),
        signedAt: new Date(),
        status: SOAStatus.SIGNED,
        notes,
      }, tenantId);
    }

    // Calculate expiration date (CMS typically requires SOA within 48 hours of appointment)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day validity

    // Create new SOA
    const soa = await this.prisma.sOA.create({
      data: {
        leadId,
        tenantId,
        productsDiscussed: productsDiscussed.join(', '),
        captureMethod,
        documentUrl,
        ipAddress,
        userAgent,
        notes,
        createdBy,
        status: captureMethod === 'Electronic' ? SOAStatus.SIGNED : SOAStatus.PENDING,
        signedAt: captureMethod === 'Electronic' ? new Date() : undefined,
        expiresAt,
      },
      include: {
        lead: true,
        creator: true,
      },
    });

    return this.mapToSOAWithDetails(soa);
  }

  /**
   * Update an existing SOA
   */
  async updateSOA(
    soaId: string,
    input: UpdateSOAInput,
    tenantId: string
  ): Promise<SOAWithDetails> {
    const soa = await this.prisma.sOA.update({
      where: { id: soaId },
      data: {
        ...input,
        updatedAt: new Date(),
      },
      include: {
        lead: true,
        creator: true,
      },
    });

    return this.mapToSOAWithDetails(soa);
  }

  /**
   * Get SOA by lead ID
   */
  async getSOAByLeadId(leadId: string): Promise<SOAWithDetails | null> {
    const soa = await this.prisma.sOA.findUnique({
      where: { leadId },
      include: {
        lead: true,
        creator: true,
      },
    });

    if (!soa) {
      return null;
    }

    return this.mapToSOAWithDetails(soa);
  }

  /**
   * Check if SOA is valid for given products
   */
  async isSOAValidForProducts(leadId: string, products: string[]): Promise<boolean> {
    const soa = await this.getSOAByLeadId(leadId);

    if (!soa) {
      return false;
    }

    // Check status
    if (soa.status !== SOAStatus.SIGNED) {
      return false;
    }

    // Check expiration
    if (soa.isExpired) {
      return false;
    }

    // Check if products are covered
    const productsDiscussed = soa.productsDiscussed?.split(',').map((p) => p.trim()) || [];
    const allProductsCovered = products.every((product) =>
      productsDiscussed.some((discussed) =>
        discussed.toLowerCase().includes(product.toLowerCase())
      )
    );

    return allProductsCovered;
  }

  /**
   * Mark SOA as signed
   */
  async markAsSigned(soaId: string, documentUrl?: string): Promise<SOAWithDetails> {
    return this.updateSOA(soaId, {
      status: SOAStatus.SIGNED,
      signedAt: new Date(),
      documentUrl,
    }, ''); // tenantId not needed for update
  }

  /**
   * Revoke an SOA
   */
  async revokeSOA(soaId: string, reason?: string): Promise<SOAWithDetails> {
    return this.updateSOA(soaId, {
      status: SOAStatus.REVOKED,
      revokedAt: new Date(),
      notes: reason,
    }, '');
  }

  /**
   * Get expiring SOAs (for notifications)
   */
  async getExpiringSoonSOAs(tenantId: string, daysThreshold: number = 7): Promise<SOAWithDetails[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const soas = await this.prisma.sOA.findMany({
      where: {
        tenantId,
        status: SOAStatus.SIGNED,
        expiresAt: {
          lte: thresholdDate,
          gte: new Date(), // Not already expired
        },
      },
      include: {
        lead: true,
        creator: true,
      },
      orderBy: {
        expiresAt: 'asc',
      },
    });

    return soas.map(this.mapToSOAWithDetails);
  }

  /**
   * Map Prisma SOA to SOAWithDetails
   */
  private mapToSOAWithDetails(soa: any): SOAWithDetails {
    const now = new Date();
    const isExpired = soa.expiresAt ? new Date(soa.expiresAt) < now : false;
    const daysUntilExpiration = soa.expiresAt
      ? Math.ceil((new Date(soa.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    return {
      id: soa.id,
      leadId: soa.leadId,
      leadName: soa.lead ? `${soa.lead.firstName} ${soa.lead.lastName}` : 'Unknown',
      status: soa.status,
      productsDiscussed: soa.productsDiscussed?.split(',').map((p: string) => p.trim()) || [],
      requestedAt: soa.requestedAt,
      signedAt: soa.signedAt,
      expiresAt: soa.expiresAt,
      isExpired,
      daysUntilExpiration,
      captureMethod: soa.captureMethod,
      documentUrl: soa.documentUrl,
      createdBy: soa.createdBy,
      createdByName: soa.creator?.name || undefined,
    };
  }
}
