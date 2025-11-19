/**
 * Dialer Provider Interface
 *
 * Abstract interface that all dialer implementations must conform to.
 * This enables the CRM to work with multiple dialers (EnrollHere, Twilio, Five9, etc.)
 * in a pluggable, swappable manner.
 */

import type {
  DialerProvider as IDialerProvider,
  InitiateCallParams,
  InitiateCallResponse,
  CallStatusResponse,
  CallRecordingResponse,
  DialerWebhookEvent,
} from '@/types/dialer';

/**
 * Abstract base class for dialer providers
 */
export abstract class DialerProvider implements IDialerProvider {
  protected config: Record<string, unknown>;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  /**
   * Initialize a call
   */
  abstract initiateCall(params: InitiateCallParams): Promise<InitiateCallResponse>;

  /**
   * Get call status from the dialer
   */
  abstract getCallStatus(callId: string): Promise<CallStatusResponse>;

  /**
   * End/terminate an active call
   */
  abstract endCall(callId: string): Promise<void>;

  /**
   * Get call recording URL and metadata
   */
  abstract getRecording(callId: string): Promise<CallRecordingResponse | null>;

  /**
   * Verify webhook signature for security
   */
  abstract verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean;

  /**
   * Parse incoming webhook into standardized format
   */
  abstract parseWebhook(payload: unknown): DialerWebhookEvent;

  /**
   * Health check - verify dialer API is reachable
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get provider name
   */
  abstract getProviderName(): string;
}
