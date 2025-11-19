/**
 * Audit logging types
 */

import type { AuditAction } from '@prisma/client';

/**
 * Audit log entry creation input
 */
export interface CreateAuditLogInput {
  tenantId?: string;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: AuditMetadata;
}

/**
 * Audit metadata
 */
export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
  changes?: FieldChange[];
  reason?: string;
  [key: string]: unknown;
}

/**
 * Field change tracking
 */
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  dataType?: string;
}

/**
 * Audit log with user and tenant details
 */
export interface AuditLogWithDetails {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;

  // Actor
  userId?: string;
  userName?: string;
  userEmail?: string;

  // Tenant
  tenantId?: string;
  tenantName?: string;

  // Changes
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes?: FieldChange[];

  // Context
  metadata?: AuditMetadata;

  createdAt: Date;
}

/**
 * Audit log filters
 */
export interface AuditLogFilters {
  tenantId?: string;
  userId?: string;
  action?: AuditAction[];
  entityType?: string[];
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

/**
 * Entity audit history request
 */
export interface EntityAuditHistoryRequest {
  entityType: string;
  entityId: string;
  limit?: number;
  offset?: number;
}

/**
 * Entity audit history response
 */
export interface EntityAuditHistoryResponse {
  entityType: string;
  entityId: string;
  history: AuditLogWithDetails[];
  total: number;
}

/**
 * Audit trail for compliance reporting
 */
export interface ComplianceAuditTrail {
  entityType: string;
  entityId: string;
  entityName: string;

  // Timeline of events
  events: Array<{
    timestamp: Date;
    action: AuditAction;
    actor: string;
    description: string;
    changes?: FieldChange[];
    complianceRelevant: boolean;
  }>;

  // Summary
  createdAt: Date;
  lastModifiedAt: Date;
  totalChanges: number;
  actors: string[];
}

/**
 * Audit summary statistics
 */
export interface AuditSummaryStats {
  totalEvents: number;
  uniqueUsers: number;
  uniqueEntities: number;

  // By action
  byAction: Record<AuditAction, number>;

  // By entity type
  byEntityType: Record<string, number>;

  // By user
  topUsers: Array<{
    userId: string;
    userName: string;
    actionCount: number;
  }>;

  // Timeline
  eventTimeline: Array<{
    date: Date;
    count: number;
  }>;
}

/**
 * Audit export options
 */
export interface AuditExportOptions {
  format: 'csv' | 'json' | 'pdf';
  filters: AuditLogFilters;
  includeMetadata?: boolean;
  includeChanges?: boolean;
}

/**
 * Helper to create audit metadata from HTTP request
 */
export interface HttpRequestContext {
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  headers?: Record<string, string>;
}

/**
 * Audit logger interface
 */
export interface IAuditLogger {
  /**
   * Log an action
   */
  log(input: CreateAuditLogInput): Promise<void>;

  /**
   * Log entity creation
   */
  logCreate(
    entityType: string,
    entityId: string,
    data: Record<string, unknown>,
    context?: { userId?: string; tenantId?: string; metadata?: AuditMetadata }
  ): Promise<void>;

  /**
   * Log entity update
   */
  logUpdate(
    entityType: string,
    entityId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    context?: { userId?: string; tenantId?: string; metadata?: AuditMetadata }
  ): Promise<void>;

  /**
   * Log entity deletion
   */
  logDelete(
    entityType: string,
    entityId: string,
    data: Record<string, unknown>,
    context?: { userId?: string; tenantId?: string; metadata?: AuditMetadata }
  ): Promise<void>;

  /**
   * Get entity history
   */
  getEntityHistory(entityType: string, entityId: string): Promise<AuditLogWithDetails[]>;
}
