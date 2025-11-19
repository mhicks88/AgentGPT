/**
 * EnrollHere Dialer Provider Implementation
 *
 * Phase 1 implementation for EnrollHere integration.
 *
 * IMPORTANT: This implementation makes reasonable assumptions about the EnrollHere API.
 * Once actual API documentation is available, update the implementation accordingly.
 *
 * Assumed API capabilities:
 * - REST API for initiating calls
 * - Webhooks for call status updates
 * - Call recording retrieval
 * - Signature-based webhook verification
 */

import crypto from 'crypto';
import axios, { type AxiosInstance } from 'axios';
import { DialerProvider } from './DialerProvider';
import type {
  InitiateCallParams,
  InitiateCallResponse,
  CallStatusResponse,
  CallRecordingResponse,
  DialerWebhookEvent,
  EnrollHere,
} from '@/types/dialer';
import { CallStatus } from '@prisma/client';

export class EnrollHereProvider extends DialerProvider {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: EnrollHere.Config) {
    super(config);

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.enrollhere.com'; // Assumed

    // Initialize HTTP client
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });
  }

  getProviderName(): string {
    return 'EnrollHere';
  }

  /**
   * Initiate an outbound call via EnrollHere
   *
   * ASSUMPTION: EnrollHere has a POST /calls endpoint
   */
  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResponse> {
    try {
      const payload: EnrollHere.InitiateCallRequest = {
        to: params.toNumber,
        from: params.fromNumber,
        metadata: {
          leadId: params.leadId,
          agentId: params.agentId,
          ...params.metadata,
        },
        recordCall: params.recordCall ?? true,
      };

      // ASSUMPTION: POST /v1/calls endpoint
      const response = await this.client.post<EnrollHere.InitiateCallResponse>(
        '/v1/calls',
        payload
      );

      return {
        success: true,
        dialerCallId: response.data.call_id,
        status: this.mapStatus(response.data.status),
      };
    } catch (error: any) {
      console.error('EnrollHere: Failed to initiate call', error);

      return {
        success: false,
        dialerCallId: '',
        status: CallStatus.FAILED,
        error: error?.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Get call status from EnrollHere
   *
   * ASSUMPTION: GET /calls/:callId endpoint
   */
  async getCallStatus(callId: string): Promise<CallStatusResponse> {
    try {
      // ASSUMPTION: GET /v1/calls/:callId endpoint
      const response = await this.client.get<EnrollHere.CallStatusResponse>(
        `/v1/calls/${callId}`
      );

      return {
        dialerCallId: response.data.call_id,
        status: this.mapStatus(response.data.status),
        direction: response.data.direction === 'inbound' ? 'INBOUND' : 'OUTBOUND',
        fromNumber: response.data.from,
        toNumber: response.data.to,
        startedAt: response.data.started_at ? new Date(response.data.started_at) : undefined,
        endedAt: response.data.ended_at ? new Date(response.data.ended_at) : undefined,
        duration: response.data.duration,
        recordingAvailable: !!response.data.recording_url,
      };
    } catch (error: any) {
      console.error('EnrollHere: Failed to get call status', error);
      throw new Error(`Failed to get call status: ${error.message}`);
    }
  }

  /**
   * End an active call
   *
   * ASSUMPTION: DELETE /calls/:callId or POST /calls/:callId/end
   */
  async endCall(callId: string): Promise<void> {
    try {
      // ASSUMPTION: POST /v1/calls/:callId/end endpoint
      await this.client.post(`/v1/calls/${callId}/end`);
    } catch (error: any) {
      console.error('EnrollHere: Failed to end call', error);
      throw new Error(`Failed to end call: ${error.message}`);
    }
  }

  /**
   * Get call recording
   *
   * ASSUMPTION: Recording URL is available in call status response
   */
  async getRecording(callId: string): Promise<CallRecordingResponse | null> {
    try {
      const callStatus = await this.getCallStatus(callId);

      // If no recording available, fetch from recordings endpoint
      // ASSUMPTION: GET /v1/calls/:callId/recording endpoint
      const response = await this.client.get<{ recording_url: string; duration?: number }>(
        `/v1/calls/${callId}/recording`
      );

      if (!response.data.recording_url) {
        return null;
      }

      return {
        recordingUrl: response.data.recording_url,
        duration: response.data.duration || callStatus.duration,
        format: 'mp3', // Assumed format
      };
    } catch (error: any) {
      console.error('EnrollHere: Failed to get recording', error);
      return null;
    }
  }

  /**
   * Verify webhook signature
   *
   * ASSUMPTION: EnrollHere uses HMAC-SHA256 signature verification
   * Similar to Twilio, Stripe, etc.
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('EnrollHere: Signature verification failed', error);
      return false;
    }
  }

  /**
   * Parse webhook payload into standardized format
   */
  parseWebhook(payload: unknown): DialerWebhookEvent {
    const data = payload as EnrollHere.WebhookPayload;

    return {
      eventType: this.mapEventType(data.event),
      dialerCallId: data.call_id,
      timestamp: new Date(data.timestamp),
      status: data.status ? this.mapStatus(data.status) : undefined,
      fromNumber: data.from,
      toNumber: data.to,
      duration: data.duration,
      recordingUrl: data.recording_url,
      rawPayload: payload,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // ASSUMPTION: GET /v1/health or /v1/ping endpoint
      await this.client.get('/v1/health');
      return true;
    } catch (error) {
      console.error('EnrollHere: Health check failed', error);
      return false;
    }
  }

  /**
   * Map EnrollHere status to our CallStatus enum
   *
   * ASSUMPTION: EnrollHere uses similar status values
   */
  private mapStatus(enrollHereStatus: string): CallStatus {
    const statusMap: Record<string, CallStatus> = {
      'initiated': CallStatus.INITIATED,
      'ringing': CallStatus.RINGING,
      'in-progress': CallStatus.IN_PROGRESS,
      'in_progress': CallStatus.IN_PROGRESS,
      'completed': CallStatus.COMPLETED,
      'no-answer': CallStatus.NO_ANSWER,
      'no_answer': CallStatus.NO_ANSWER,
      'busy': CallStatus.BUSY,
      'failed': CallStatus.FAILED,
      'voicemail': CallStatus.VOICEMAIL,
      'cancelled': CallStatus.CANCELLED,
      'canceled': CallStatus.CANCELLED,
    };

    return statusMap[enrollHereStatus.toLowerCase()] || CallStatus.FAILED;
  }

  /**
   * Map EnrollHere event type to our standardized event type
   */
  private mapEventType(enrollHereEvent: string): any {
    const eventMap: Record<string, any> = {
      'call.initiated': 'call.initiated',
      'call.ringing': 'call.ringing',
      'call.answered': 'call.answered',
      'call.completed': 'call.completed',
      'call.failed': 'call.failed',
      'call.no-answer': 'call.no-answer',
      'call.busy': 'call.busy',
      'recording.available': 'recording.available',
      'recording.transcribed': 'recording.transcribed',
    };

    return eventMap[enrollHereEvent.toLowerCase()] || enrollHereEvent;
  }
}
