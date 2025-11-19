/**
 * Compliance Engine
 *
 * Core engine for evaluating compliance rules before, during, and after calls.
 * This is the heart of the compliance-first CRM.
 *
 * Key responsibilities:
 * - Evaluate pre-call compliance checks
 * - Provide in-call guidance and scripts
 * - Evaluate post-call compliance
 * - Record all checks and evidence in audit logs
 */

import type { PrismaClient } from '@prisma/client';
import { ComplianceRuleType, ComplianceCheckResult } from '@prisma/client';
import type {
  PreCallCheckRequest,
  PreCallCheckResponse,
  PostCallComplianceInput,
  PostCallCheckResponse,
  CallScript,
  ComplianceCheckDetail,
  ComplianceViolation,
  ComplianceWarning,
} from '@/types/compliance';
import { RuleEvaluator } from './RuleEvaluator';
import { SOAManager } from './SOAManager';

export class ComplianceEngine {
  constructor(
    private prisma: PrismaClient,
    private ruleEvaluator: RuleEvaluator,
    private soaManager: SOAManager
  ) {}

  /**
   * Run pre-call compliance check
   *
   * Evaluates all relevant PRE_CALL rules and determines if the call can proceed.
   */
  async runPreCallCheck(
    request: PreCallCheckRequest,
    tenantId: string
  ): Promise<PreCallCheckResponse> {
    const { leadId, agentId, intendedProducts } = request;

    // Fetch lead and active compliance rules
    const [lead, rules] = await Promise.all([
      this.prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          soa: true,
          contactInfo: {
            where: { type: 'phone', isPrimary: true },
          },
        },
      }),
      this.prisma.complianceRule.findMany({
        where: {
          tenantId,
          isActive: true,
          ruleType: {
            in: [
              ComplianceRuleType.PRE_CALL,
              ComplianceRuleType.DNC_CHECK,
              ComplianceRuleType.TIME_RESTRICTION,
              ComplianceRuleType.SOA_REQUIREMENT,
            ],
          },
        },
        orderBy: { priority: 'desc' },
      }),
    ]);

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Evaluate each rule
    const checks: ComplianceCheckDetail[] = [];
    const failures: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];
    const evidence: Record<string, unknown> = {
      leadId,
      agentId,
      intendedProducts,
      leadStatus: lead.status,
      leadIsDNC: lead.isDNC,
      soaStatus: lead.soa?.status,
    };

    for (const rule of rules) {
      const result = await this.ruleEvaluator.evaluate(rule, {
        lead,
        agentId,
        intendedProducts,
        tenantId,
      });

      checks.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.ruleType,
        result: result.result,
        isBlocking: rule.isBlocking,
        executedAt: new Date(),
        details: result.details,
      });

      // Collect failures and warnings
      if (result.result === ComplianceCheckResult.FAIL) {
        if (rule.isBlocking) {
          failures.push({
            ruleId: rule.id,
            ruleName: rule.name,
            reason: result.reason || 'Compliance check failed',
            remediation: result.remediation || 'Please address the compliance issue',
            severity: 'critical',
          });
        } else {
          warnings.push({
            ruleId: rule.id,
            ruleName: rule.name,
            reason: result.reason || 'Compliance check failed',
            recommendation: result.remediation || 'Consider addressing this issue',
            severity: 'medium',
          });
        }
      }

      // Add rule-specific evidence
      if (result.evidence) {
        evidence[`rule_${rule.id}`] = result.evidence;
      }
    }

    // Determine overall result
    const hasBlockingFailures = failures.length > 0;
    const overallResult = hasBlockingFailures
      ? ComplianceCheckResult.FAIL
      : warnings.length > 0
      ? ComplianceCheckResult.WARNING
      : ComplianceCheckResult.PASS;

    // Record the compliance check run
    const checkRun = await this.prisma.complianceCheckRun.create({
      data: {
        tenantId,
        leadId,
        userId: agentId,
        checkType: ComplianceRuleType.PRE_CALL,
        result: overallResult,
        rulesEvaluated: rules.map((r) => r.id),
        failures: failures.length > 0 ? failures : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        evidence,
      },
    });

    // Generate recommendations
    const recommendations: string[] = [];
    if (lead.isDNC) {
      recommendations.push('Lead is on Do Not Contact list. Verify reason before proceeding.');
    }
    if (!lead.soa && intendedProducts?.length) {
      recommendations.push('Consider obtaining Scope of Appointment before discussing products.');
    }

    return {
      canProceed: !hasBlockingFailures,
      result: overallResult,
      checkRunId: checkRun.id,
      checks,
      failures,
      warnings,
      evidence,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    };
  }

  /**
   * Generate in-call script and guidance
   *
   * Provides the agent with required disclaimers, checklist items, and call guidance.
   */
  async generateCallScript(
    callId: string,
    leadId: string,
    tenantId: string
  ): Promise<CallScript> {
    // Fetch lead, SOA, and disclaimer templates
    const [lead, disclaimers, inCallRules] = await Promise.all([
      this.prisma.lead.findUnique({
        where: { id: leadId },
        include: { soa: true },
      }),
      this.prisma.disclaimerTemplate.findMany({
        where: { tenantId, isActive: true },
      }),
      this.prisma.complianceRule.findMany({
        where: {
          tenantId,
          isActive: true,
          ruleType: ComplianceRuleType.IN_CALL,
        },
      }),
    ]);

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Build required disclaimers list
    const requiredDisclaimers = disclaimers.map((d) => ({
      id: d.id,
      name: d.name,
      text: d.text,
      isRequired: d.isRequired,
      wasRead: false,
    }));

    // Build compliance checklist from in-call rules
    const checklist = inCallRules.map((rule) => ({
      id: rule.id,
      item: rule.description || rule.name,
      isRequired: rule.isBlocking,
      isCompleted: false,
    }));

    // SOA status
    const soaStatus = {
      hasSoa: !!lead.soa,
      status: lead.soa?.status,
      expiresAt: lead.soa?.expiresAt,
      requiredProducts: [], // TODO: Extract from compliance rules
    };

    // General guidance
    const guidance = [
      'Verify you are speaking with the lead or authorized representative',
      'Read all required disclaimers clearly',
      'Confirm Scope of Appointment before discussing products',
      'Take notes during the call for compliance records',
    ];

    return {
      callId,
      leadId,
      requiredDisclaimers,
      checklist,
      soaStatus,
      guidance,
    };
  }

  /**
   * Run post-call compliance check
   *
   * Evaluates compliance based on what happened during the call.
   */
  async runPostCallCheck(
    input: PostCallComplianceInput,
    tenantId: string,
    agentId: string
  ): Promise<PostCallCheckResponse> {
    const { callId, disclaimersRead, soaCaptured, soaDetails, notes } = input;

    // Fetch call and related data
    const [call, postCallRules, requiredDisclaimers] = await Promise.all([
      this.prisma.call.findUnique({
        where: { id: callId },
        include: { lead: { include: { soa: true } } },
      }),
      this.prisma.complianceRule.findMany({
        where: {
          tenantId,
          isActive: true,
          ruleType: ComplianceRuleType.POST_CALL,
        },
      }),
      this.prisma.disclaimerTemplate.findMany({
        where: { tenantId, isActive: true, isRequired: true },
      }),
    ]);

    if (!call) {
      throw new Error('Call not found');
    }

    // Evaluate post-call rules
    const checks: ComplianceCheckDetail[] = [];
    const failures: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    // Check disclaimers
    const missingDisclaimers = requiredDisclaimers
      .filter((d) => !disclaimersRead.includes(d.id))
      .map((d) => d.name);

    if (missingDisclaimers.length > 0) {
      failures.push({
        ruleId: 'disclaimer-check',
        ruleName: 'Required Disclaimers',
        reason: `Missing required disclaimers: ${missingDisclaimers.join(', ')}`,
        remediation: 'All required disclaimers must be read during the call',
        severity: 'high',
      });
    }

    // Record disclaimer acknowledgments
    if (disclaimersRead.length > 0) {
      await Promise.all(
        disclaimersRead.map((disclaimerId) =>
          this.prisma.disclaimerAcknowledgment.create({
            data: {
              callId,
              disclaimerId,
              userId: agentId,
              wasRead: true,
              wasAcknowledged: true,
            },
          })
        )
      );
    }

    // Check SOA if captured
    const missingSOA = soaCaptured === false && !call.lead.soa;

    if (soaCaptured && soaDetails) {
      await this.soaManager.createSOA({
        leadId: call.leadId,
        productsDiscussed: soaDetails.productsDiscussed,
        captureMethod: soaDetails.captureMethod,
        documentUrl: soaDetails.documentUrl,
      }, agentId, tenantId);
    }

    // Evaluate other post-call rules
    for (const rule of postCallRules) {
      const result = await this.ruleEvaluator.evaluate(rule, {
        call,
        disclaimersRead,
        soaCaptured,
        tenantId,
      });

      checks.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.ruleType,
        result: result.result,
        isBlocking: rule.isBlocking,
        executedAt: new Date(),
        details: result.details,
      });

      if (result.result === ComplianceCheckResult.FAIL && rule.isBlocking) {
        failures.push({
          ruleId: rule.id,
          ruleName: rule.name,
          reason: result.reason || 'Post-call compliance check failed',
          remediation: result.remediation || 'Address compliance issue',
          severity: 'high',
        });
      }
    }

    // Determine overall result
    const overallResult = failures.length > 0
      ? ComplianceCheckResult.FAIL
      : warnings.length > 0
      ? ComplianceCheckResult.WARNING
      : ComplianceCheckResult.PASS;

    // Record the compliance check run
    const checkRun = await this.prisma.complianceCheckRun.create({
      data: {
        tenantId,
        callId,
        leadId: call.leadId,
        userId: agentId,
        checkType: ComplianceRuleType.POST_CALL,
        result: overallResult,
        rulesEvaluated: postCallRules.map((r) => r.id),
        failures: failures.length > 0 ? failures : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        evidence: {
          disclaimersRead,
          soaCaptured,
          notes,
        },
      },
    });

    return {
      isCompliant: failures.length === 0,
      result: overallResult,
      checkRunId: checkRun.id,
      checks,
      failures,
      warnings,
      missingDisclaimers,
      missingSOA,
    };
  }
}
