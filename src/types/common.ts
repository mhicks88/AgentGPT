/**
 * Common types used across the application
 */

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Filter operators for advanced filtering
 */
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'startsWith'
  | 'endsWith';

/**
 * Generic filter condition
 */
export interface FilterCondition<T = any> {
  field: string;
  operator: FilterOperator;
  value: T;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Multi-tenant context
 */
export interface TenantContext {
  tenantId: string;
  userId: string;
  userRole: string;
}

/**
 * Metadata for tracking changes
 */
export interface ChangeMetadata {
  createdBy?: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt: Date;
}

/**
 * Time window for business hours
 */
export interface TimeWindow {
  start: string; // "HH:MM" format
  end: string; // "HH:MM" format
}

/**
 * Business hours configuration
 */
export interface BusinessHours {
  monday?: TimeWindow;
  tuesday?: TimeWindow;
  wednesday?: TimeWindow;
  thursday?: TimeWindow;
  friday?: TimeWindow;
  saturday?: TimeWindow;
  sunday?: TimeWindow;
}

/**
 * Address structure
 */
export interface Address {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}
