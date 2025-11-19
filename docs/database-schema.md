# Database Schema Documentation

## Overview

This document describes the database schema for the Compliance-First CRM platform for insurance agents, with a focus on Medicare sales and marketing compliance.

## Schema Design Principles

### 1. Multi-Tenancy
- **Every tenant-scoped table includes `tenantId`**
- Enables row-level security and data isolation
- All queries must be scoped by tenant except for system admins
- Indexed on `tenantId` for query performance

### 2. Compliance-First Architecture
- Compliance data models are first-class entities (not afterthoughts)
- Immutable audit logging captures all important actions
- SOA (Scope of Appointment) tracking built into core data model
- Pre-call, in-call, and post-call compliance checks are structured and auditable

### 3. Auditability
- `AuditLog` table is immutable (no updates or deletes)
- Captures before/after state for all changes
- Stores metadata (IP address, user agent, etc.)
- Indexed for efficient querying and reporting

### 4. Extensibility
- JSON fields for custom data (`customFields`, `metadata`, `config`)
- Dialer abstraction via `DialerConfiguration` and `DialerType` enum
- Rule-based compliance engine (data-driven, not hard-coded)
- Tenant-level configuration for disclaimers and lead statuses

### 5. Type Safety
- Rich enums for all status fields
- Prevents invalid states at the database level
- Clear documentation via inline comments

---

## Core Entity Groups

### 🏢 Multi-Tenant Core

#### Tenant
The top-level organization entity (insurance agency).

**Key Fields:**
- `slug`: URL-friendly identifier for subdomain routing
- `timezone`: Default timezone for business hours
- `businessHours`: JSON configuration for calling hours by day of week
- `planTier`: Subscription level (for billing)

**Relationships:**
- Has many Users, Leads, ComplianceRules, DialerConfigurations

#### User
Represents agents, supervisors, admins, and system admins.

**Key Fields:**
- `role`: AGENT | SUPERVISOR | ADMIN | SYSTEM_ADMIN
- `agentLicenseNumber`: Insurance license tracking
- `licenseState` & `licenseExpiry`: Compliance tracking for agent credentials
- `lastLoginAt`: Security and activity monitoring

**Relationships:**
- Belongs to Tenant (nullable for SYSTEM_ADMIN)
- Has many assigned Leads, Calls, Tasks, Notes

---

### 👥 CRM Core - Leads & Contacts

#### Lead
The central entity representing a potential customer.

**Key Fields:**
- `status`: LeadStatus enum (NEW → CONTACTED → QUALIFIED → SOA_SIGNED → ENROLLED, etc.)
- `isDNC`: Do Not Contact flag (critical for compliance)
- `dncReason` & `dncDate`: Evidence for DNC status
- `lastContactedAt` & `nextFollowUpAt`: Activity tracking
- `medicareNumber`: Medicare-specific identifier (encrypted in production)
- `customFields`: JSON for extensibility

**Compliance Features:**
- DNC tracking prevents unauthorized calls
- Links to SOA for appointment scope validation
- Activity timeline reconstruction via Activities

**Relationships:**
- Belongs to Tenant
- Assigned to User (agent)
- Has many ContactInfo, Calls, Tasks, Notes, Activities
- Has one SOA

#### ContactInfo
Flexible contact information storage (phone, email, address).

**Key Fields:**
- `type`: "phone", "email", "address", "mobile", "work_phone"
- `isPrimary`: Identifies primary contact method
- `isVerified`: Verification status for phone/email
- `isMobile`: Important for SMS compliance

**Design Note:**
- Supports multiple phone numbers and emails per lead
- Enables verification workflows

#### LeadStatusConfig
Allows tenant-level customization of lead status labels and colors.

**Key Fields:**
- `statusValue`: Maps to LeadStatus enum
- `displayName`: Custom label (e.g., "Hot Lead" instead of "QUALIFIED")
- `color`: Hex color for UI
- `sortOrder`: Custom ordering in UI

---

### 📞 Dialer Integration

#### DialerConfiguration
Stores credentials and settings for external dialer integrations.

**Key Fields:**
- `dialerType`: ENROLL_HERE | TWILIO | FIVE9 | CONVOSO | CUSTOM
- `apiKey`, `apiSecret`, `accountSid`: Auth credentials (encrypt in production!)
- `webhookSecret`: For webhook signature verification
- `config`: JSON for dialer-specific settings
- `isPrimary`: Designates the default dialer for the tenant

**Security Note:**
- Credentials should be encrypted at rest
- Consider using a secrets manager (AWS Secrets Manager, HashiCorp Vault)

#### Call
Represents a phone call (inbound or outbound).

**Key Fields:**
- `direction`: OUTBOUND | INBOUND
- `status`: INITIATED → RINGING → IN_PROGRESS → COMPLETED
- `outcome`: CONNECTED, NO_ANSWER, SOA_OBTAINED, DNC_REQUESTED, etc.
- `dialerCallId`: Maps to external dialer's call record
- `duration`: Call duration in seconds
- `dialerMetadata`: JSON for dialer-specific data

**Relationships:**
- Belongs to Lead, User (agent), DialerConfiguration
- Has one CallRecording
- Has many ComplianceCheckRuns, DisclaimerAcknowledgments, CallNotes

#### CallRecording
Stores call recording metadata and links to audio files.

**Key Fields:**
- `recordingUrl`: S3 URL or external storage URL
- `transcriptUrl` & `transcriptText`: AI transcription (Phase 2)
- `isProcessed`: Processing status for async workflows

---

### ✅ Compliance Engine

#### ComplianceRule
Data-driven compliance rules that can be configured per tenant.

**Key Fields:**
- `ruleType`: PRE_CALL | IN_CALL | POST_CALL | DNC_CHECK | TIME_RESTRICTION | SOA_REQUIREMENT | DISCLOSURE | RECORDING
- `config`: JSON configuration specific to rule type
  - Example (DNC): `{ "checkInternalDNC": true, "checkFederalDNC": true }`
  - Example (TIME_RESTRICTION): `{ "allowedHours": { "start": "08:00", "end": "21:00" }, "timezone": "lead" }`
- `isBlocking`: If false, rule generates warning but doesn't prevent action
- `priority`: Execution order for multiple rules

**Design Philosophy:**
- Rules are **data-driven**, not hard-coded
- Each tenant can enable/disable or customize rules
- Easy to add new rule types without code changes

#### ComplianceCheckRun
Records the execution and results of compliance checks.

**Key Fields:**
- `checkType`: What type of check was performed
- `result`: PASS | FAIL | WARNING | NOT_APPLICABLE
- `rulesEvaluated`: JSON array of rule IDs evaluated
- `failures`: JSON details of failures (e.g., `{ "ruleId": "...", "reason": "Lead is on DNC list" }`)
- `evidence`: Supporting data for the check (e.g., timestamps, DNC list source)

**Auditability:**
- Every check is recorded
- Can reconstruct what rules were evaluated at call time
- Enables compliance reporting and audits

**Relationships:**
- Belongs to Call (nullable for pre-call checks)
- References Lead, User, and ComplianceRules evaluated

#### SOA (Scope of Appointment)
Tracks Scope of Appointment for Medicare sales compliance.

**Key Fields:**
- `status`: PENDING | SIGNED | EXPIRED | REVOKED
- `productsDiscussed`: What products can be discussed (e.g., "Medicare Advantage, Part D")
- `signedAt`, `expiresAt`: Validity period
- `captureMethod`: "Electronic" | "Verbal" | "Physical Form"
- `documentUrl`: Link to signed document (if uploaded)
- `ipAddress`, `userAgent`: Capture evidence for electronic signatures

**CMS Compliance:**
- SOA must be obtained before discussing certain products
- Must be within a certain timeframe of appointment
- Must specify which product types are in scope

**Relationships:**
- One-to-one with Lead
- Belongs to User (creator)

#### DisclaimerTemplate
Configurable disclaimer text that must be read during calls.

**Key Fields:**
- `text`: The actual disclaimer text
- `isRequired`: Must be acknowledged
- `appliesTo`: JSON conditions (e.g., `{ "productTypes": ["MA"], "states": ["CA"] }`)

**Example:**
> "I do not work for the federal government or Medicare, and this call is not connected with or endorsed by the U.S. government or the federal Medicare program."

#### DisclaimerAcknowledgment
Tracks that a disclaimer was read during a call.

**Key Fields:**
- `wasRead`: Agent marked as read
- `wasAcknowledged`: Lead acknowledged (if applicable)
- `timestamp`: When it was read

**Relationships:**
- Belongs to Call, DisclaimerTemplate, User

---

### 📋 Tasks, Notes & Activities

#### Task
Follow-up tasks and reminders for agents.

**Key Fields:**
- `title`, `description`: Task details
- `status`: PENDING | IN_PROGRESS | COMPLETED | CANCELLED | OVERDUE
- `priority`: LOW | MEDIUM | HIGH | URGENT
- `dueAt`: Due date/time
- `assignedTo`: User (agent)

**Relationships:**
- Optionally linked to Lead
- Assigned to User

#### Note
Freeform notes attached to leads.

**Key Fields:**
- `content`: Note text
- `isPinned`: Pin important notes to top

**Relationships:**
- Belongs to Lead, User

#### Activity
Automated activity timeline for leads.

**Key Fields:**
- `type`: "status_change", "call_completed", "note_added", "task_completed", etc.
- `description`: Human-readable description
- `metadata`: JSON for additional context

**Use Case:**
- Automatic logging when events occur
- Generates a timeline view for each lead
- Example: "Status changed from NEW to CONTACTED by John Doe"

---

### 🔒 Audit Logging

#### AuditLog
**IMMUTABLE** audit trail of all important actions.

**Key Fields:**
- `action`: CREATE | UPDATE | DELETE | CALL_INITIATED | COMPLIANCE_CHECK | SOA_CAPTURED, etc.
- `entityType`: "Lead", "Call", "SOA", "User"
- `entityId`: ID of the entity
- `before`: JSON snapshot before change
- `after`: JSON snapshot after change
- `metadata`: IP address, user agent, additional context

**Critical Design Decisions:**
- **NO updates or deletes allowed** (immutable)
- Indexed for fast querying by tenant, user, entity, action, and timestamp
- Enables full reconstruction of entity history
- Supports compliance audits and forensics

**Relationships:**
- Belongs to Tenant, User (actor)

---

## Indexes & Performance

### Multi-Tenant Queries
All tenant-scoped tables are indexed on `tenantId` to ensure fast filtering.

### Common Query Patterns
- **Lead assignment**: Indexed on `assignedTo`, `status`
- **Call history**: Indexed on `leadId`, `userId`, `initiatedAt`
- **Compliance checks**: Indexed on `result`, `executedAt`
- **Audit logs**: Composite index on `[entityType, entityId]` for entity history reconstruction

### Foreign Key Indexes
Prisma's `relationMode = "prisma"` requires manual indexes on all foreign keys (already added).

---

## Migration Strategy

### Initial Migration
```bash
npx prisma generate
npx prisma db push  # For development
npx prisma migrate dev --name init  # For production-ready migration
```

### Data Seeding
Consider creating seed scripts for:
- Default compliance rules (CMS federal rules)
- Default disclaimer templates
- Example tenant for development

---

## Security Considerations

### Sensitive Data
The following fields contain sensitive data and should be encrypted:
- `Lead.medicareNumber`
- `Lead.dateOfBirth`
- `DialerConfiguration.apiKey`
- `DialerConfiguration.apiSecret`

**Recommendation:** Use field-level encryption or application-level encryption before storing.

### Row-Level Security
Implement middleware to automatically scope all queries by `tenantId`:

```typescript
// Example Prisma middleware
prisma.$use(async (params, next) => {
  if (params.model && !['Account', 'Session', 'VerificationToken'].includes(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = { ...params.args.where, tenantId: currentTenantId };
    }
  }
  return next(params);
});
```

---

## Phase 2 Enhancements

Future schema additions:
- **Call transcription analysis**: AI-powered compliance checking
- **Document management**: Store and version SOA PDFs, policy documents
- **Email integration**: Track email communications
- **SMS/text messaging**: Compliance for SMS campaigns
- **Carrier integrations**: Direct enrollment APIs
- **Advanced reporting**: Materialized views, analytics tables

---

## ERD Summary

```
Tenant (1) ──< (M) User
Tenant (1) ──< (M) Lead
Tenant (1) ──< (M) ComplianceRule
Tenant (1) ──< (M) DialerConfiguration

Lead (1) ──< (M) ContactInfo
Lead (1) ──< (M) Call
Lead (1) ──< (M) Task
Lead (1) ──< (M) Note
Lead (1) ──< (M) Activity
Lead (1) ──< (1) SOA
Lead (1) ──< (M) Opportunity

User (1) ──< (M) Lead [assigned]
User (1) ──< (M) Call
User (1) ──< (M) Task [assigned]

Call (1) ──< (1) CallRecording
Call (1) ──< (M) ComplianceCheckRun
Call (1) ──< (M) DisclaimerAcknowledgment
Call (1) ──< (M) CallNote

ComplianceRule (M) ──< (M) ComplianceCheckRun
```

---

## Questions & Design Decisions

### Why separate ContactInfo table?
- Supports multiple phone numbers/emails per lead
- Enables verification workflows
- Flexibility for future contact types

### Why JSON for ComplianceRule.config?
- Each rule type has different configuration needs
- Avoids creating many rule-type-specific tables
- Validated at application layer with Zod schemas

### Why both Activity and AuditLog?
- **Activity**: User-facing timeline for leads (filtered, curated)
- **AuditLog**: Complete, immutable forensic trail (all entities, all actions)

### Why keep legacy Agent/AgentTask tables?
- Maintains backward compatibility with original AgentGPT
- Can be removed if not needed in final implementation
