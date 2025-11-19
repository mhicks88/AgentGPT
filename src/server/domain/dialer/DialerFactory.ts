/**
 * Dialer Factory
 *
 * Factory pattern for creating dialer provider instances.
 * Handles instantiation of the correct provider based on configuration.
 */

import { DialerType } from '@prisma/client';
import type { DialerProvider } from './DialerProvider';
import { EnrollHereProvider } from './EnrollHereProvider';
import type { EnrollHere } from '@/types/dialer';

/**
 * Factory class for creating dialer providers
 */
export class DialerFactory {
  /**
   * Create a dialer provider instance based on type and configuration
   */
  static createProvider(
    dialerType: DialerType,
    config: Record<string, unknown>
  ): DialerProvider {
    switch (dialerType) {
      case DialerType.ENROLL_HERE:
        return new EnrollHereProvider(config as EnrollHere.Config);

      // Phase 2: Add more providers
      // case DialerType.TWILIO:
      //   return new TwilioProvider(config as Twilio.Config);
      //
      // case DialerType.FIVE9:
      //   return new Five9Provider(config as Five9.Config);
      //
      // case DialerType.CONVOSO:
      //   return new ConvosoProvider(config as Convoso.Config);

      default:
        throw new Error(`Unsupported dialer type: ${dialerType}`);
    }
  }

  /**
   * Create provider from database configuration
   */
  static createFromDialerConfig(dialerConfig: {
    dialerType: DialerType;
    apiKey?: string | null;
    apiSecret?: string | null;
    accountSid?: string | null;
    baseUrl?: string | null;
    webhookSecret?: string | null;
    config?: any;
  }): DialerProvider {
    // Build config object based on dialer type
    const config: Record<string, unknown> = {
      ...dialerConfig.config,
      apiKey: dialerConfig.apiKey,
      apiSecret: dialerConfig.apiSecret,
      accountSid: dialerConfig.accountSid,
      baseUrl: dialerConfig.baseUrl,
      webhookSecret: dialerConfig.webhookSecret,
    };

    return this.createProvider(dialerConfig.dialerType, config);
  }
}
