# API Reference - Compliance CRM

## Overview

The CRM API is built with tRPC, providing end-to-end type-safe procedures for all operations. All API calls are automatically scoped by tenant for data isolation.

## Authentication & Authorization

### Procedure Types

| Procedure Type | Auth Required | Tenant Required | Role Required |
|----------------|---------------|-----------------|---------------|
| `publicProcedure` | No | No | None |
| `protectedProcedure` | Yes | No | None |
| `tenantProcedure` | Yes | Yes | None |
| `supervisorProcedure` | Yes | Yes | SUPERVISOR+ |
| `adminProcedure` | Yes | Yes | ADMIN+ |

### Context Available

All authenticated procedures have access to:
- `ctx.userId` - Current user ID
- `ctx.tenantId` - Current tenant/organization ID
- `ctx.userRole` - User role (AGENT, SUPERVISOR, ADMIN, SYSTEM_ADMIN)
- `ctx.services` - Domain services (lead, task, note, compliance, etc.)
- `ctx.prisma` - Direct Prisma client access

---

## 📋 Lead Router (`lead.*`)

### Queries

#### `lead.getById`
Get a lead by ID with full details.

**Input:**
```typescript
{
  id: string
}
```

**Returns:** `LeadWithDetails`

**Example:**
```typescript
const lead = await trpc.lead.getById.query({ id: 'lead_123' });
```

---

#### `lead.list`
List leads with filters and pagination.

**Input:**
```typescript
{
  filters?: {
    status?: LeadStatus[]
    assignedTo?: string[]
    source?: LeadSource[]
    isDNC?: boolean
    search?: string
    createdAfter?: Date
    createdBefore?: Date
  }
  pagination?: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }
}
```

**Returns:** `PaginatedResponse<LeadWithDetails>`

---

#### `lead.myLeads`
Get leads assigned to current user.

**Input:**
```typescript
{
  status?: LeadStatus[]
  pagination?: { page?: number, limit?: number }
}
```

**Returns:** `PaginatedResponse<LeadWithDetails>`

---

#### `lead.getActivityTimeline`
Get activity timeline for a lead.

**Input:**
```typescript
{
  leadId: string
  limit?: number
}
```

**Returns:** `Activity[]`

---

#### `lead.getNotes`
Get all notes for a lead.

**Input:**
```typescript
{
  leadId: string
}
```

**Returns:** `Note[]`

---

#### `lead.getTasks`
Get all tasks for a lead.

**Input:**
```typescript
{
  leadId: string
}
```

**Returns:** `Task[]`

---

#### `lead.getCalls`
Get call history for a lead.

**Input:**
```typescript
{
  leadId: string
  limit?: number
}
```

**Returns:** `Call[]`

---

### Mutations

#### `lead.create`
Create a new lead.

**Input:**
```typescript
{
  firstName: string
  lastName: string
  email?: string
  dateOfBirth?: Date
  assignedTo?: string
  source: LeadSource
  medicareNumber?: string
  isCurrentlyInsured?: boolean
  currentCarrier?: string
  phones?: Array<{
    type: 'mobile' | 'home' | 'work'
    number: string
    isPrimary?: boolean
  }>
  tags?: string[]
  customFields?: Record<string, unknown>
}
```

**Returns:** `Lead`

---

#### `lead.update`
Update a lead.

**Input:**
```typescript
{
  id: string
  data: {
    firstName?: string
    lastName?: string
    email?: string
    status?: LeadStatus
    assignedTo?: string
    isDNC?: boolean
    dncReason?: string
    nextFollowUpAt?: Date
    tags?: string[]
  }
}
```

**Returns:** `Lead`

---

#### `lead.updateStatus`
Update lead status.

**Input:**
```typescript
{
  id: string
  status: LeadStatus
}
```

---

#### `lead.assign`
Assign lead to an agent.

**Input:**
```typescript
{
  leadId: string
  agentId: string
}
```

---

#### `lead.markAsDNC`
Mark lead as Do Not Contact.

**Input:**
```typescript
{
  leadId: string
  reason: string
}
```

---

#### `lead.removeDNC`
Remove DNC status from lead.

**Input:**
```typescript
{
  leadId: string
}
```

---

## ✅ Task Router (`task.*`)

### Queries

#### `task.list`
List tasks with filters.

**Input:**
```typescript
{
  filters?: {
    status?: TaskStatus[]
    priority?: TaskPriority[]
    assignedTo?: string[]
    leadId?: string
    dueAfter?: Date
    dueBefore?: Date
    isOverdue?: boolean
  }
  pagination?: { page?: number, limit?: number }
}
```

---

#### `task.myTasks`
Get tasks assigned to current user.

**Input:**
```typescript
{
  status?: TaskStatus[]
}
```

---

#### `task.overdue`
Get overdue tasks for current user.

**Input:** None

**Returns:** `Task[]`

---

#### `task.dueToday`
Get tasks due today for current user.

**Input:** None

**Returns:** `Task[]`

---

### Mutations

#### `task.create`
Create a new task.

**Input:**
```typescript
{
  title: string
  description?: string
  leadId?: string
  assignedTo: string
  priority?: TaskPriority
  dueAt?: Date
}
```

---

#### `task.update`
Update a task.

**Input:**
```typescript
{
  id: string
  data: {
    title?: string
    description?: string
    status?: TaskStatus
    priority?: TaskPriority
    dueAt?: Date
  }
}
```

---

#### `task.complete`
Mark task as completed.

**Input:**
```typescript
{
  id: string
}
```

---

#### `task.delete`
Delete a task.

**Input:**
```typescript
{
  id: string
}
```

---

## 📝 Note Router (`note.*`)

### Queries

#### `note.getByLead`
Get all notes for a lead.

**Input:**
```typescript
{
  leadId: string
}
```

**Returns:** `Note[]`

---

### Mutations

#### `note.create`
Create a note.

**Input:**
```typescript
{
  leadId: string
  content: string
  isPinned?: boolean
}
```

---

#### `note.update`
Update note content.

**Input:**
```typescript
{
  id: string
  content: string
}
```

---

#### `note.togglePin`
Pin/unpin a note.

**Input:**
```typescript
{
  id: string
}
```

---

#### `note.delete`
Delete a note.

**Input:**
```typescript
{
  id: string
}
```

---

## 🔒 Compliance Router (`compliance.*`)

### Pre-Call Compliance

#### `compliance.preCallCheck`
**CRITICAL:** Run before initiating any call.

Checks:
- DNC status
- SOA requirements
- Time restrictions
- State-specific rules

**Input:**
```typescript
{
  leadId: string
  intendedProducts?: string[]
}
```

**Returns:**
```typescript
{
  canProceed: boolean
  result: ComplianceCheckResult
  checkRunId: string
  checks: ComplianceCheckDetail[]
  failures: ComplianceViolation[]
  warnings: ComplianceWarning[]
  evidence: Record<string, unknown>
  recommendations?: string[]
}
```

**Example:**
```typescript
const check = await trpc.compliance.preCallCheck.mutate({
  leadId: 'lead_123',
  intendedProducts: ['Medicare Advantage', 'Part D']
});

if (!check.canProceed) {
  console.log('Cannot proceed:', check.failures);
} else {
  // Initiate call
}
```

---

### In-Call Support

#### `compliance.getCallScript`
Get in-call script with required disclaimers and checklist.

**Input:**
```typescript
{
  callId: string
  leadId: string
}
```

**Returns:**
```typescript
{
  callId: string
  leadId: string
  requiredDisclaimers: Array<{
    id: string
    name: string
    text: string
    isRequired: boolean
    wasRead: boolean
  }>
  checklist: Array<{
    id: string
    item: string
    isRequired: boolean
    isCompleted: boolean
  }>
  soaStatus: {
    hasSoa: boolean
    status?: SOAStatus
    expiresAt?: Date
    requiredProducts: string[]
  }
  guidance: string[]
}
```

---

### Post-Call Compliance

#### `compliance.postCallSubmit`
Submit post-call compliance data.

**Input:**
```typescript
{
  callId: string
  disclaimersRead: string[]  // Array of disclaimer IDs
  soaCaptured?: boolean
  soaDetails?: {
    productsDiscussed: string[]
    captureMethod: 'Electronic' | 'Verbal' | 'Physical Form'
    documentUrl?: string
  }
  notes?: string
}
```

**Returns:**
```typescript
{
  isCompliant: boolean
  result: ComplianceCheckResult
  checkRunId: string
  checks: ComplianceCheckDetail[]
  failures: ComplianceViolation[]
  warnings: ComplianceWarning[]
  missingDisclaimers: string[]
  missingSOA: boolean
}
```

---

### SOA Management (`compliance.soa.*`)

#### `compliance.soa.create`
Create a Scope of Appointment.

**Input:**
```typescript
{
  leadId: string
  productsDiscussed: string[]
  captureMethod: 'Electronic' | 'Verbal' | 'Physical Form'
  documentUrl?: string
  ipAddress?: string
  userAgent?: string
  notes?: string
}
```

---

#### `compliance.soa.getByLead`
Get SOA for a lead.

**Input:**
```typescript
{
  leadId: string
}
```

**Returns:** `SOAWithDetails | null`

---

#### `compliance.soa.markAsSigned`
Mark SOA as signed.

**Input:**
```typescript
{
  id: string
  documentUrl?: string
}
```

---

#### `compliance.soa.revoke`
Revoke an SOA.

**Input:**
```typescript
{
  id: string
  reason?: string
}
```

---

#### `compliance.soa.expiringSoon`
Get SOAs expiring soon.

**Input:**
```typescript
{
  daysThreshold?: number  // default: 7
}
```

**Returns:** `SOAWithDetails[]`

---

#### `compliance.soa.checkValidity`
Check if SOA is valid for specific products.

**Input:**
```typescript
{
  leadId: string
  products: string[]
}
```

**Returns:**
```typescript
{
  isValid: boolean
}
```

---

### Compliance History

#### `compliance.getCheckHistory`
Get compliance check history.

**Input:**
```typescript
{
  leadId?: string
  callId?: string
  limit?: number
}
```

**Returns:** `ComplianceCheckRun[]`

---

### Admin: Rules Management (`compliance.rules.*`)

**Required Role:** ADMIN

#### `compliance.rules.list`
List all compliance rules.

---

#### `compliance.rules.create`
Create a compliance rule.

**Input:**
```typescript
{
  name: string
  description?: string
  ruleType: string
  config: Record<string, unknown>
  isActive?: boolean
  isBlocking?: boolean
  priority?: number
}
```

---

#### `compliance.rules.update`
Update a compliance rule.

---

#### `compliance.rules.delete`
Delete a compliance rule.

---

### Admin: Disclaimers (`compliance.disclaimers.*`)

**Required Role:** ADMIN

#### `compliance.disclaimers.list`
List disclaimer templates.

---

#### `compliance.disclaimers.create`
Create disclaimer template.

**Input:**
```typescript
{
  name: string
  description?: string
  text: string
  isRequired?: boolean
  appliesTo?: {
    productTypes?: string[]
    states?: string[]
  }
}
```

---

#### `compliance.disclaimers.update`
Update disclaimer template.

---

#### `compliance.disclaimers.delete`
Delete disclaimer template.

---

## Error Handling

All procedures may throw tRPC errors:

| Code | Meaning |
|------|---------|
| `UNAUTHORIZED` | Not authenticated |
| `FORBIDDEN` | No permission or not member of tenant |
| `NOT_FOUND` | Resource not found |
| `BAD_REQUEST` | Invalid input |
| `INTERNAL_SERVER_ERROR` | Server error |

**Example Error Handling:**
```typescript
try {
  const lead = await trpc.lead.create.mutate({ ... });
} catch (error) {
  if (error.data?.code === 'FORBIDDEN') {
    console.log('No permission');
  }
}
```

---

## Type Safety

All procedures are fully type-safe. Import types from the AppRouter:

```typescript
import type { AppRouter } from '@/server/api/root';
import { createTRPCProxyClient } from '@trpc/client';

const trpc = createTRPCProxyClient<AppRouter>({ ... });

// TypeScript knows all available procedures and their types
const leads = await trpc.lead.list.query({ ... });
//    ^? PaginatedResponse<LeadWithDetails>
```

---

## Audit Logging

All mutations automatically create audit log entries with:
- User ID (actor)
- Tenant ID
- Timestamp
- Before/after state
- Action type
- Metadata

Access audit logs via Prisma:
```typescript
const logs = await ctx.prisma.auditLog.findMany({
  where: { entityType: 'Lead', entityId: leadId }
});
```

---

## Rate Limiting

**TODO:** Implement rate limiting for production:
- 100 requests/minute per user
- 1000 requests/minute per tenant

---

## Webhook Events

**TODO (Phase 2):** Implement webhooks for:
- `lead.created`
- `lead.status_changed`
- `call.completed`
- `compliance.violation`
- `soa.expiring`
