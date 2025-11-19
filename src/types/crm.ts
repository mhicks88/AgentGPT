/**
 * CRM domain types
 */

import type { LeadStatus, LeadSource, TaskStatus, TaskPriority } from '@prisma/client';

/**
 * Lead list filters
 */
export interface LeadFilters {
  status?: LeadStatus[];
  assignedTo?: string[];
  source?: LeadSource[];
  isDNC?: boolean;
  search?: string; // Search by name, email, phone
  createdAfter?: Date;
  createdBefore?: Date;
  lastContactedAfter?: Date;
  lastContactedBefore?: Date;
  tags?: string[];
}

/**
 * Lead with computed fields and relations
 */
export interface LeadWithDetails {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string; // Computed: firstName + lastName
  email?: string;
  status: LeadStatus;
  source: LeadSource;
  isDNC: boolean;

  // Relations
  assignedAgent?: {
    id: string;
    name: string;
    email: string;
  };

  primaryPhone?: string;
  primaryEmail?: string;

  // Counts
  callCount: number;
  noteCount: number;
  taskCount: number;

  // SOA status
  soaStatus?: 'PENDING' | 'SIGNED' | 'EXPIRED' | 'REVOKED';

  // Tracking
  lastContactedAt?: Date;
  nextFollowUpAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lead creation input
 */
export interface CreateLeadInput {
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth?: Date;

  // Contact info
  phones?: Array<{
    type: 'mobile' | 'home' | 'work';
    number: string;
    isPrimary?: boolean;
  }>;

  // Assignment
  assignedTo?: string;
  source: LeadSource;

  // Medicare-specific
  medicareNumber?: string;
  isCurrentlyInsured?: boolean;
  currentCarrier?: string;

  // Custom data
  tags?: string[];
  customFields?: Record<string, unknown>;
}

/**
 * Lead update input
 */
export interface UpdateLeadInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  dateOfBirth?: Date;
  status?: LeadStatus;
  assignedTo?: string;
  isDNC?: boolean;
  dncReason?: string;
  nextFollowUpAt?: Date;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

/**
 * Task filters
 */
export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assignedTo?: string[];
  leadId?: string;
  dueAfter?: Date;
  dueBefore?: Date;
  isOverdue?: boolean;
}

/**
 * Task creation input
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  leadId?: string;
  assignedTo: string;
  priority?: TaskPriority;
  dueAt?: Date;
}

/**
 * Task update input
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: Date;
  completedAt?: Date;
}

/**
 * Note creation input
 */
export interface CreateNoteInput {
  leadId: string;
  content: string;
  isPinned?: boolean;
}

/**
 * Activity type
 */
export type ActivityType =
  | 'lead_created'
  | 'lead_updated'
  | 'status_changed'
  | 'lead_assigned'
  | 'call_initiated'
  | 'call_completed'
  | 'note_added'
  | 'task_created'
  | 'task_completed'
  | 'soa_captured'
  | 'soa_signed'
  | 'opportunity_created';

/**
 * Activity with metadata
 */
export interface ActivityWithMetadata {
  id: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  userName?: string;
  createdAt: Date;
}

/**
 * Lead timeline entry (combines activities, calls, notes, tasks)
 */
export interface LeadTimelineEntry {
  id: string;
  type: 'activity' | 'call' | 'note' | 'task';
  timestamp: Date;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  user?: {
    id: string;
    name: string;
  };
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  // Lead metrics
  totalLeads: number;
  newLeadsToday: number;
  myActiveLeads: number;
  leadsRequiringFollowUp: number;

  // Call metrics
  callsMadeToday: number;
  callsMadeThisWeek: number;
  averageCallDuration: number;

  // Task metrics
  tasksOverdue: number;
  tasksDueToday: number;
  tasksCompleted: number;

  // Compliance metrics
  complianceViolations: number;
  leadsWithoutSOA: number;

  // Lead status breakdown
  leadsByStatus: Record<LeadStatus, number>;
}

/**
 * Agent performance metrics
 */
export interface AgentPerformanceMetrics {
  agentId: string;
  agentName: string;

  // Activity
  callsMade: number;
  leadsContacted: number;
  appointmentsSet: number;
  enrollments: number;

  // Compliance
  complianceScore: number; // 0-100
  complianceViolations: number;

  // Time period
  periodStart: Date;
  periodEnd: Date;
}
