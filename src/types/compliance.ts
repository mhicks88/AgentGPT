/**
 * Compliance domain types
 */

import type {
  ComplianceRuleType,
  ComplianceCheckResult,
  SOAStatus,
} from '@prisma/client';

/**
 * Pre-call compliance check request
 */
export interface PreCallCheckRequest {
  leadId: string;
  agentId: string;
  intendedProducts?: string[]; // e.g., ["Medicare Advantage", "Part D"]
}

/**
 * Pre-call compliance check response
 */
export interface PreCallCheckResponse {
  canProceed: boolean;
  result: ComplianceCheckResult;
  checkRunId: string; // ID of the ComplianceCheckRun record

  // Detailed results
  checks: ComplianceCheckDetail[];

  // Failures/Blockers
  failures: ComplianceViolation[];
  warnings: ComplianceWarning[];

  // Evidence
  evidence: Record<string, unknown>;

  // Recommendations
  recommendations?: string[];
}

/**
 * Individual compliance check detail
 */
export interface ComplianceCheckDetail {
  ruleId: string;
  ruleName: string;
  ruleType: ComplianceRuleType;
  result: ComplianceCheckResult;
  isBlocking: boolean;
  executedAt: Date;
  details?: string;
}

/**
 * Compliance violation (blocking)
 */
export interface ComplianceViolation {
  ruleId: string;
  ruleName: string;
  reason: string;
  remediation: string; // How to fix it
  severity: 'critical' | 'high';
}

/**
 * Compliance warning (non-blocking)
 */
export interface ComplianceWarning {
  ruleId: string;
  ruleName: string;
  reason: string;
  recommendation: string;
  severity: 'medium' | 'low';
}

/**
 * Post-call compliance submission
 */
export interface PostCallComplianceInput {
  callId: string;
  disclaimersRead: string[]; // Array of disclaimer IDs
  soaCaptured?: boolean;
  soaDetails?: {
    productsDiscussed: string[];
    captureMethod: 'Electronic' | 'Verbal' | 'Physical Form';
    documentUrl?: string;
  };
  notes?: string;
}

/**
 * Post-call compliance check response
 */
export interface PostCallCheckResponse {
  isCompliant: boolean;
  result: ComplianceCheckResult;
  checkRunId: string;

  checks: ComplianceCheckDetail[];
  failures: ComplianceViolation[];
  warnings: ComplianceWarning[];

  // Missing items
  missingDisclaimers: string[];
  missingSOA: boolean;
}

/**
 * Compliance rule configuration by type
 */

// DNC Check Configuration
export interface DNCCheckConfig {
  checkInternalDNC: boolean;
  checkFederalDNC: boolean; // Phase 2: integrate with federal DNC registry
  checkStateDNC: boolean; // Phase 2
}

// Time Restriction Configuration
export interface TimeRestrictionConfig {
  allowedHours: {
    start: string; // "HH:MM"
    end: string; // "HH:MM"
  };
  timezone: 'tenant' | 'lead' | 'agent'; // Whose timezone to use
  allowedDaysOfWeek?: number[]; // 0=Sunday, 6=Saturday
}

// SOA Requirement Configuration
export interface SOARequirementConfig {
  requiredForProducts: string[]; // ["Medicare Advantage", "Part D"]
  expirationDays: number; // Days until SOA expires
  allowExpiredWithWarning: boolean;
}

// Disclosure Requirement Configuration
export interface DisclosureRequirementConfig {
  requiredDisclaimerIds: string[];
  productSpecific?: Record<string, string[]>; // Product type -> disclaimer IDs
}

// Recording Requirement Configuration
export interface RecordingRequirementConfig {
  requireRecording: boolean;
  recordingRetentionDays: number;
  allowProceedWithoutRecording: boolean;
}

/**
 * Union type for all rule configs
 */
export type ComplianceRuleConfig =
  | DNCCheckConfig
  | TimeRestrictionConfig
  | SOARequirementConfig
  | DisclosureRequirementConfig
  | RecordingRequirementConfig
  | Record<string, unknown>; // Extensible for future rule types

/**
 * Compliance rule creation/update input
 */
export interface ComplianceRuleInput {
  name: string;
  description?: string;
  ruleType: ComplianceRuleType;
  config: ComplianceRuleConfig;
  isActive?: boolean;
  isBlocking?: boolean;
  priority?: number;
}

/**
 * SOA creation input
 */
export interface CreateSOAInput {
  leadId: string;
  productsDiscussed: string[];
  captureMethod: 'Electronic' | 'Verbal' | 'Physical Form';
  documentUrl?: string;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
}

/**
 * SOA update input
 */
export interface UpdateSOAInput {
  status?: SOAStatus;
  productsDiscussed?: string[];
  signedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  notes?: string;
}

/**
 * SOA with lead details
 */
export interface SOAWithDetails {
  id: string;
  leadId: string;
  leadName: string;
  status: SOAStatus;
  productsDiscussed?: string[];
  requestedAt: Date;
  signedAt?: Date;
  expiresAt?: Date;
  isExpired: boolean; // Computed
  daysUntilExpiration?: number; // Computed
  captureMethod?: string;
  documentUrl?: string;
  createdBy?: string;
  createdByName?: string;
}

/**
 * Disclaimer template creation input
 */
export interface CreateDisclaimerInput {
  name: string;
  description?: string;
  text: string;
  isRequired?: boolean;
  appliesTo?: {
    productTypes?: string[];
    states?: string[];
  };
}

/**
 * Disclaimer acknowledgment during call
 */
export interface DisclaimerAcknowledgment {
  disclaimerId: string;
  wasRead: boolean;
  wasAcknowledged: boolean;
  timestamp: Date;
  notes?: string;
}

/**
 * In-call guidance/script
 */
export interface CallScript {
  callId: string;
  leadId: string;

  // Required disclaimers
  requiredDisclaimers: Array<{
    id: string;
    name: string;
    text: string;
    isRequired: boolean;
    wasRead: boolean;
  }>;

  // Compliance checklist
  checklist: Array<{
    id: string;
    item: string;
    isRequired: boolean;
    isCompleted: boolean;
  }>;

  // SOA status
  soaStatus: {
    hasSoa: boolean;
    status?: SOAStatus;
    expiresAt?: Date;
    requiredProducts: string[];
  };

  // Call guidance
  guidance: string[];
}

/**
 * Compliance report filters
 */
export interface ComplianceReportFilters {
  startDate: Date;
  endDate: Date;
  agentIds?: string[];
  ruleTypes?: ComplianceRuleType[];
  results?: ComplianceCheckResult[];
}

/**
 * Compliance report summary
 */
export interface ComplianceReportSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;

  // By rule type
  byRuleType: Record<ComplianceRuleType, {
    total: number;
    passed: number;
    failed: number;
  }>;

  // By agent
  byAgent: Array<{
    agentId: string;
    agentName: string;
    totalChecks: number;
    passed: number;
    failed: number;
    complianceRate: number; // percentage
  }>;

  // Common violations
  topViolations: Array<{
    ruleId: string;
    ruleName: string;
    count: number;
    percentage: number;
  }>;

  // Trends
  dailyStats: Array<{
    date: Date;
    total: number;
    passed: number;
    failed: number;
  }>;
}

/**
 * CMS-specific rule types (Phase 1 focus)
 */
export const CMSRuleTypes = {
  // Required disclaimers
  NOT_GOVERNMENT_AFFILIATED: 'NOT_GOVERNMENT_AFFILIATED',
  PLAN_AVAILABILITY_DISCLAIMER: 'PLAN_AVAILABILITY_DISCLAIMER',

  // SOA requirements
  SOA_BEFORE_APPOINTMENT: 'SOA_BEFORE_APPOINTMENT',
  SOA_PRODUCT_SCOPE: 'SOA_PRODUCT_SCOPE',

  // Time restrictions
  CALLING_HOURS: 'CALLING_HOURS',

  // Recording
  CALL_RECORDING_CONSENT: 'CALL_RECORDING_CONSENT',
} as const;

export type CMSRuleType = typeof CMSRuleTypes[keyof typeof CMSRuleTypes];
