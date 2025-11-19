/**
 * Rule Evaluator
 *
 * Evaluates individual compliance rules based on their type and configuration.
 * This is where the actual compliance logic lives.
 */

import type { ComplianceRule } from '@prisma/client';
import { ComplianceRuleType, ComplianceCheckResult } from '@prisma/client';
import type {
  DNCCheckConfig,
  TimeRestrictionConfig,
  SOARequirementConfig,
  DisclosureRequirementConfig,
} from '@/types/compliance';

/**
 * Rule evaluation context
 */
export interface RuleEvaluationContext {
  lead?: any;
  call?: any;
  agentId?: string;
  tenantId?: string;
  intendedProducts?: string[];
  disclaimersRead?: string[];
  soaCaptured?: boolean;
  [key: string]: unknown;
}

/**
 * Rule evaluation result
 */
export interface RuleEvaluationResult {
  result: ComplianceCheckResult;
  reason?: string;
  remediation?: string;
  details?: string;
  evidence?: Record<string, unknown>;
}

export class RuleEvaluator {
  /**
   * Evaluate a compliance rule
   */
  async evaluate(
    rule: ComplianceRule,
    context: RuleEvaluationContext
  ): Promise<RuleEvaluationResult> {
    switch (rule.ruleType) {
      case ComplianceRuleType.DNC_CHECK:
        return this.evaluateDNCCheck(rule, context);

      case ComplianceRuleType.TIME_RESTRICTION:
        return this.evaluateTimeRestriction(rule, context);

      case ComplianceRuleType.SOA_REQUIREMENT:
        return this.evaluateSOARequirement(rule, context);

      case ComplianceRuleType.DISCLOSURE:
        return this.evaluateDisclosure(rule, context);

      case ComplianceRuleType.RECORDING:
        return this.evaluateRecording(rule, context);

      default:
        return {
          result: ComplianceCheckResult.NOT_APPLICABLE,
          details: 'Rule type not yet implemented',
        };
    }
  }

  /**
   * Evaluate DNC (Do Not Contact) check
   */
  private evaluateDNCCheck(
    rule: ComplianceRule,
    context: RuleEvaluationContext
  ): RuleEvaluationResult {
    const config = rule.config as DNCCheckConfig;
    const { lead } = context;

    if (!lead) {
      return {
        result: ComplianceCheckResult.NOT_APPLICABLE,
        details: 'No lead provided',
      };
    }

    // Check internal DNC flag
    if (config.checkInternalDNC && lead.isDNC) {
      return {
        result: ComplianceCheckResult.FAIL,
        reason: 'Lead is on internal Do Not Contact list',
        remediation: `Lead was marked DNC on ${lead.dncDate}. Reason: ${lead.dncReason || 'Not specified'}. Remove DNC flag if this was in error.`,
        evidence: {
          isDNC: true,
          dncDate: lead.dncDate,
          dncReason: lead.dncReason,
        },
      };
    }

    // Phase 2: Check federal DNC registry
    // if (config.checkFederalDNC) {
    //   const isOnFederalDNC = await this.checkFederalDNC(lead);
    //   if (isOnFederalDNC) { ... }
    // }

    return {
      result: ComplianceCheckResult.PASS,
      details: 'Lead is not on Do Not Contact list',
      evidence: {
        isDNC: false,
      },
    };
  }

  /**
   * Evaluate time restriction check
   */
  private evaluateTimeRestriction(
    rule: ComplianceRule,
    context: RuleEvaluationContext
  ): RuleEvaluationResult {
    const config = rule.config as TimeRestrictionConfig;
    const now = new Date();

    // Determine which timezone to use
    const timezone = this.getRelevantTimezone(config.timezone, context);

    // Get current time in relevant timezone
    const currentHour = now.getHours(); // Simplified - should use timezone library
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    // Parse allowed hours
    const [startHour, startMinute] = config.allowedHours.start.split(':').map(Number);
    const [endHour, endMinute] = config.allowedHours.end.split(':').map(Number);
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    // Check if current time is within allowed window
    if (currentTime < startTime || currentTime > endTime) {
      return {
        result: ComplianceCheckResult.FAIL,
        reason: `Call time ${currentHour}:${currentMinute.toString().padStart(2, '0')} is outside allowed hours`,
        remediation: `Calls are only allowed between ${config.allowedHours.start} and ${config.allowedHours.end}`,
        evidence: {
          currentTime: now.toISOString(),
          allowedStart: config.allowedHours.start,
          allowedEnd: config.allowedHours.end,
          timezone,
        },
      };
    }

    // Check day of week if configured
    if (config.allowedDaysOfWeek && config.allowedDaysOfWeek.length > 0) {
      const currentDay = now.getDay();
      if (!config.allowedDaysOfWeek.includes(currentDay)) {
        return {
          result: ComplianceCheckResult.FAIL,
          reason: 'Calls not allowed on this day of week',
          remediation: 'Check configured allowed days for calling',
          evidence: {
            currentDay,
            allowedDays: config.allowedDaysOfWeek,
          },
        };
      }
    }

    return {
      result: ComplianceCheckResult.PASS,
      details: 'Call time is within allowed hours',
      evidence: {
        currentTime: now.toISOString(),
        timezone,
      },
    };
  }

  /**
   * Evaluate SOA (Scope of Appointment) requirement
   */
  private evaluateSOARequirement(
    rule: ComplianceRule,
    context: RuleEvaluationContext
  ): RuleEvaluationResult {
    const config = rule.config as SOARequirementConfig;
    const { lead, intendedProducts } = context;

    if (!lead) {
      return {
        result: ComplianceCheckResult.NOT_APPLICABLE,
        details: 'No lead provided',
      };
    }

    // Check if intended products require SOA
    const requiresSOA =
      intendedProducts?.some((product) =>
        config.requiredForProducts.includes(product)
      ) ?? false;

    if (!requiresSOA) {
      return {
        result: ComplianceCheckResult.NOT_APPLICABLE,
        details: 'SOA not required for intended products',
      };
    }

    // Check if SOA exists
    if (!lead.soa) {
      return {
        result: ComplianceCheckResult.FAIL,
        reason: 'Scope of Appointment required but not on file',
        remediation: 'Obtain SOA before discussing Medicare products',
        evidence: {
          hasSoa: false,
          intendedProducts,
          requiredForProducts: config.requiredForProducts,
        },
      };
    }

    // Check SOA status
    if (lead.soa.status !== 'SIGNED') {
      return {
        result: ComplianceCheckResult.FAIL,
        reason: `SOA status is ${lead.soa.status}, must be SIGNED`,
        remediation: 'Obtain signed SOA before proceeding',
        evidence: {
          soaStatus: lead.soa.status,
        },
      };
    }

    // Check if SOA is expired
    if (lead.soa.expiresAt && new Date(lead.soa.expiresAt) < new Date()) {
      if (config.allowExpiredWithWarning) {
        return {
          result: ComplianceCheckResult.WARNING,
          reason: 'SOA has expired',
          remediation: 'Consider obtaining new SOA',
          evidence: {
            soaExpired: true,
            expiresAt: lead.soa.expiresAt,
          },
        };
      } else {
        return {
          result: ComplianceCheckResult.FAIL,
          reason: 'SOA has expired',
          remediation: 'Obtain new SOA before proceeding',
          evidence: {
            soaExpired: true,
            expiresAt: lead.soa.expiresAt,
          },
        };
      }
    }

    return {
      result: ComplianceCheckResult.PASS,
      details: 'Valid SOA on file',
      evidence: {
        soaStatus: lead.soa.status,
        signedAt: lead.soa.signedAt,
        expiresAt: lead.soa.expiresAt,
      },
    };
  }

  /**
   * Evaluate disclosure requirement
   */
  private evaluateDisclosure(
    rule: ComplianceRule,
    context: RuleEvaluationContext
  ): RuleEvaluationResult {
    const config = rule.config as DisclosureRequirementConfig;
    const { disclaimersRead } = context;

    if (!disclaimersRead) {
      return {
        result: ComplianceCheckResult.NOT_APPLICABLE,
        details: 'Post-call check only',
      };
    }

    // Check if all required disclaimers were read
    const missingDisclaimers = config.requiredDisclaimerIds.filter(
      (id) => !disclaimersRead.includes(id)
    );

    if (missingDisclaimers.length > 0) {
      return {
        result: ComplianceCheckResult.FAIL,
        reason: `Missing required disclaimers: ${missingDisclaimers.length}`,
        remediation: 'All required disclaimers must be read during call',
        evidence: {
          requiredDisclaimers: config.requiredDisclaimerIds,
          disclaimersRead,
          missingDisclaimers,
        },
      };
    }

    return {
      result: ComplianceCheckResult.PASS,
      details: 'All required disclaimers were read',
      evidence: {
        disclaimersRead,
      },
    };
  }

  /**
   * Evaluate recording requirement
   */
  private evaluateRecording(
    rule: ComplianceRule,
    context: RuleEvaluationContext
  ): RuleEvaluationResult {
    const { call } = context;

    if (!call) {
      return {
        result: ComplianceCheckResult.NOT_APPLICABLE,
        details: 'No call provided',
      };
    }

    // Check if call has recording
    const hasRecording = !!call.recording;

    if (!hasRecording) {
      return {
        result: ComplianceCheckResult.WARNING,
        reason: 'Call recording not available',
        remediation: 'Ensure call recording is enabled',
        evidence: {
          hasRecording: false,
        },
      };
    }

    return {
      result: ComplianceCheckResult.PASS,
      details: 'Call recording available',
      evidence: {
        hasRecording: true,
        recordingUrl: call.recording.recordingUrl,
      },
    };
  }

  /**
   * Get relevant timezone based on configuration
   */
  private getRelevantTimezone(
    setting: 'tenant' | 'lead' | 'agent',
    context: RuleEvaluationContext
  ): string {
    // Simplified - in production, fetch actual timezone from context
    // For now, return default
    return 'America/New_York';
  }
}
