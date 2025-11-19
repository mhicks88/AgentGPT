/**
 * Dialer integration types
 */

import type { CallStatus, CallDirection, CallOutcome, DialerType } from '@prisma/client';

/**
 * Dialer provider interface
 * All dialer implementations must conform to this interface
 */
export interface DialerProvider {
  /**
   * Initialize a call
   */
  initiateCall(params: InitiateCallParams): Promise<InitiateCallResponse>;

  /**
   * Get call status
   */
  getCallStatus(callId: string): Promise<CallStatusResponse>;

  /**
   * End/terminate a call
   */
  endCall(callId: string): Promise<void>;

  /**
   * Get call recording URL
   */
  getRecording(callId: string): Promise<CallRecordingResponse | null>;

  /**
   * Verify webhook signature (for security)
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;

  /**
   * Parse webhook payload into standardized format
   */
  parseWebhook(payload: unknown): DialerWebhookEvent;
}

/**
 * Parameters for initiating a call
 */
export interface InitiateCallParams {
  fromNumber: string;
  toNumber: string;
  leadId: string;
  agentId: string;

  // Metadata to attach to the call
  metadata?: Record<string, unknown>;

  // Recording preferences
  recordCall?: boolean;
}

/**
 * Response from initiating a call
 */
export interface InitiateCallResponse {
  success: boolean;
  dialerCallId: string; // External dialer's call ID
  status: CallStatus;
  error?: string;
}

/**
 * Call status response
 */
export interface CallStatusResponse {
  dialerCallId: string;
  status: CallStatus;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number; // seconds
  recordingAvailable: boolean;
}

/**
 * Call recording response
 */
export interface CallRecordingResponse {
  recordingUrl: string;
  duration?: number;
  format?: string;
  fileSize?: number;
}

/**
 * Standardized webhook event from any dialer
 */
export interface DialerWebhookEvent {
  eventType: DialerEventType;
  dialerCallId: string;
  timestamp: Date;

  // Call details
  status?: CallStatus;
  fromNumber?: string;
  toNumber?: string;
  duration?: number;
  recordingUrl?: string;

  // Raw payload for debugging
  rawPayload: unknown;
}

/**
 * Dialer event types
 */
export type DialerEventType =
  | 'call.initiated'
  | 'call.ringing'
  | 'call.answered'
  | 'call.completed'
  | 'call.failed'
  | 'call.no-answer'
  | 'call.busy'
  | 'recording.available'
  | 'recording.transcribed';

/**
 * EnrollHere specific types (Phase 1)
 */
export namespace EnrollHere {
  /**
   * EnrollHere API configuration
   * Note: These are placeholder assumptions - adjust when actual API docs are available
   */
  export interface Config {
    apiKey: string;
    apiSecret?: string;
    baseUrl: string;
    accountId?: string;
    webhookSecret?: string;
  }

  /**
   * EnrollHere initiate call request
   * Assumption: EnrollHere has a REST API for initiating calls
   */
  export interface InitiateCallRequest {
    to: string;
    from: string;
    metadata?: Record<string, unknown>;
    recordCall?: boolean;
  }

  /**
   * EnrollHere initiate call response
   */
  export interface InitiateCallResponse {
    call_id: string;
    status: string;
    created_at: string;
  }

  /**
   * EnrollHere call status response
   */
  export interface CallStatusResponse {
    call_id: string;
    status: string;
    direction: string;
    from: string;
    to: string;
    started_at?: string;
    ended_at?: string;
    duration?: number;
    recording_url?: string;
  }

  /**
   * EnrollHere webhook payload
   */
  export interface WebhookPayload {
    event: string;
    call_id: string;
    timestamp: string;
    status?: string;
    from?: string;
    to?: string;
    duration?: number;
    recording_url?: string;
    [key: string]: unknown;
  }
}

/**
 * Twilio specific types (Phase 2)
 */
export namespace Twilio {
  export interface Config {
    accountSid: string;
    authToken: string;
    webhookSecret?: string;
  }

  // Add Twilio-specific types in Phase 2
}

/**
 * Five9 specific types (Phase 2)
 */
export namespace Five9 {
  export interface Config {
    username: string;
    password: string;
    baseUrl: string;
  }

  // Add Five9-specific types in Phase 2
}

/**
 * Dialer configuration input
 */
export interface CreateDialerConfigInput {
  dialerType: DialerType;
  name: string;
  apiKey?: string;
  apiSecret?: string;
  accountSid?: string;
  baseUrl?: string;
  webhookSecret?: string;
  config?: Record<string, unknown>;
  isPrimary?: boolean;
}

/**
 * Update dialer configuration
 */
export interface UpdateDialerConfigInput {
  name?: string;
  apiKey?: string;
  apiSecret?: string;
  accountSid?: string;
  baseUrl?: string;
  webhookSecret?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
  isPrimary?: boolean;
}

/**
 * Call creation input (internal)
 */
export interface CreateCallInput {
  leadId: string;
  userId: string;
  dialerConfigId: string;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  dialerCallId?: string;
  dialerMetadata?: Record<string, unknown>;
}

/**
 * Call update input
 */
export interface UpdateCallInput {
  status?: CallStatus;
  outcome?: CallOutcome;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
  notes?: string;
  dialerMetadata?: Record<string, unknown>;
}

/**
 * Call with details and relations
 */
export interface CallWithDetails {
  id: string;
  leadId: string;
  leadName: string;
  agentId: string;
  agentName: string;

  direction: CallDirection;
  status: CallStatus;
  outcome?: CallOutcome;

  fromNumber?: string;
  toNumber?: string;

  initiatedAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;

  // Recording
  hasRecording: boolean;
  recordingUrl?: string;

  // Compliance
  complianceChecksPassed: boolean;
  complianceIssues?: string[];

  // Notes
  notes?: string;

  dialerCallId?: string;
}

/**
 * Call filters
 */
export interface CallFilters {
  leadId?: string;
  agentId?: string;
  status?: CallStatus[];
  outcome?: CallOutcome[];
  direction?: CallDirection[];
  initiatedAfter?: Date;
  initiatedBefore?: Date;
  hasRecording?: boolean;
  complianceFailed?: boolean;
}

/**
 * Call statistics
 */
export interface CallStatistics {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  averageDuration: number;
  totalDuration: number;

  // By outcome
  byOutcome: Record<string, number>;

  // By status
  byStatus: Record<CallStatus, number>;

  // Time-based
  callsByHour: Array<{ hour: number; count: number }>;
  callsByDay: Array<{ date: Date; count: number }>;
}

/**
 * Click-to-call request
 */
export interface ClickToCallRequest {
  leadId: string;
  phoneNumber: string;
}

/**
 * Click-to-call response
 */
export interface ClickToCallResponse {
  success: boolean;
  callId: string;
  dialerCallId: string;
  message?: string;
  error?: string;
}
