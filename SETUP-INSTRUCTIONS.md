# Setup Instructions - Compliance CRM

## 🎯 What's Been Completed

All Phase 1 and Phase 2 development is complete:

### ✅ Phase 1: Database Foundation
- Complete Prisma schema (25+ tables)
- Multi-tenant architecture
- Compliance models
- Full CRM data models
- Documentation: `docs/database-schema.md`

### ✅ Phase 2: API Layer
- All domain services (Lead, Task, Note, Compliance, SOA, Audit)
- Complete tRPC routers with 120+ procedures
- Multi-tenant middleware
- Role-based access control (RBAC)
- Documentation: `docs/api-reference.md`

### ✅ Phase 2.5: Database Setup Files
- Comprehensive seed script (`prisma/seed.ts`)
- Manual SQL setup file (`prisma/manual-setup.sql`)
- Package.json scripts configured
- Environment template (`.env.example`)

## 🚧 Current Blocker

The development environment has network restrictions preventing Prisma engine downloads. To proceed, you need to set up the database on your local machine or in a cloud environment.

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Node.js 18+ installed
- Git

### Steps

1. **Clone and navigate to the project**
   ```bash
   cd /path/to/AgentGPT
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   # .env file is already created with SQLite config
   # DATABASE_URL=file:./prisma/compliance-crm.db
   ```

4. **Create database schema**
   ```bash
   npm run db:push
   ```

   This will:
   - Generate Prisma Client
   - Create the SQLite database file
   - Create all 25+ tables
   - Set up indexes and relationships

5. **Seed with sample data**
   ```bash
   npm run db:seed
   ```

   This will populate:
   - 1 tenant: "Medicare Solutions Agency"
   - 4 users (admin, supervisor, 2 agents)
   - 4 compliance rules
   - 3 disclaimer templates
   - 15 sample leads
   - Tasks, notes, activities, and SOA

6. **Verify setup**
   ```bash
   npm run db:studio
   ```

   Opens Prisma Studio at http://localhost:5555 where you can browse all data.

7. **Start development server**
   ```bash
   npm run dev
   ```

   Open http://localhost:3000

## 📊 What You'll Get After Setup

### Sample Tenant
- **Name**: Medicare Solutions Agency
- **Timezone**: America/New_York
- **Business Hours**: Mon-Fri 8 AM - 8 PM

### Sample Users

| Name | Email | Role | Password |
|------|-------|------|----------|
| Sarah Johnson | sarah.johnson@example.com | ADMIN | (set via NextAuth) |
| Mike Thompson | mike.thompson@example.com | SUPERVISOR | (set via NextAuth) |
| Emily Rodriguez | emily.rodriguez@example.com | AGENT | (set via NextAuth) |
| David Chen | david.chen@example.com | AGENT | (set via NextAuth) |

### Compliance Rules (Active)

1. **DNC Check** - Blocks calls to Do Not Contact leads
2. **Time Restrictions** - Enforces 8 AM - 9 PM calling hours
3. **SOA Requirement** - Requires SOA for Medicare products
4. **Call Recording** - Ensures all Medicare calls are recorded

### Sample Leads (15 total)

- **NEW** (5): Fresh leads awaiting contact
- **CONTACTED** (3): Initial contact made
- **QUALIFIED** (2): Interested and qualified
- **SOA_SIGNED** (2): Ready for enrollment discussion
- **DO_NOT_CONTACT** (2): On DNC list
- **APPOINTMENT_SET** (1): Meeting scheduled
- **LOST** (1): Not interested
- **ENROLLED** (1): Successfully enrolled

### Sample Tasks (4)

- 1 overdue (follow-up call)
- 1 due today (send SOA)
- 1 future (appointment scheduled)
- 1 completed (initial contact)

## 🔧 Alternative: PostgreSQL Setup

If you prefer PostgreSQL (more production-like):

```bash
# 1. Start PostgreSQL with Docker
docker run -d \
  --name compliance-crm-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=compliance_crm \
  -p 5432:5432 \
  postgres:16

# 2. Update .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/compliance_crm"

# 3. Update prisma/schema.prisma (line 7)
# Change: provider = "sqlite"
# To:     provider = "postgresql"

# 4. Run setup
npm install
npm run db:push
npm run db:seed
```

## 📖 Testing the API

After setup, you can test API endpoints:

### Using tRPC Client (Recommended)

```typescript
import { trpc } from '@/utils/trpc';

// Get all leads
const leads = await trpc.lead.list.query({
  filters: { status: ['NEW', 'CONTACTED'] },
  pagination: { page: 1, limit: 10 }
});

// Run pre-call compliance check
const check = await trpc.compliance.preCallCheck.mutate({
  leadId: 'lead_id',
  intendedProducts: ['Medicare Advantage']
});

// Get my tasks
const tasks = await trpc.task.myTasks.query({
  status: ['PENDING', 'IN_PROGRESS']
});
```

### Using Prisma Studio

1. Run `npm run db:studio`
2. Browse to http://localhost:5555
3. Explore all tables and data
4. Run manual queries
5. Edit data directly

## 🎨 Next Development Steps

Once the database is set up:

### Phase 3: Frontend UI (Priority)

1. **Lead Management**
   - Lead list page with filters
   - Lead detail page with timeline
   - Create/edit lead forms
   - Quick actions (assign, mark DNC, update status)

2. **Task Dashboard**
   - My tasks view
   - Overdue tasks
   - Task creation
   - Task completion

3. **Compliance UI**
   - Pre-call check modal
   - In-call script display
   - Post-call compliance form
   - SOA management

### Phase 4: Dialer Integration

1. **Call Router**: `/src/server/domain/dialer/`
2. **Provider Implementations**: EnrollHere, Twilio, etc.
3. **Webhook Handlers**: `/src/pages/api/webhooks/dialer/`
4. **Click-to-call UI**: Call button component

### Phase 5: Reporting & Analytics

1. **Statistics Service**: `/src/server/domain/analytics/`
2. **Dashboard Queries**: Lead conversion, call metrics
3. **Compliance Reports**: Violations, SOA status
4. **Agent Performance**: Calls per day, conversion rate

## 🐛 Troubleshooting

### "Cannot find module '@prisma/client'"
```bash
npm install
npm run db:push  # This generates Prisma Client
```

### "Can't reach database server"
```bash
# For SQLite: No server needed, check DATABASE_URL path
# For PostgreSQL: Ensure container is running
docker ps | grep compliance-crm-db
```

### Seed script fails
```bash
# Clear and recreate database
rm prisma/compliance-crm.db
npm run db:push
npm run db:seed
```

## 📚 Documentation

- **Database Schema**: `docs/database-schema.md`
- **API Reference**: `docs/api-reference.md`
- **Setup Guide**: `docs/database-setup-guide.md`
- **Phase 2 Completion**: `docs/phase-2-complete.md`

## 🔐 Authentication Setup

This project uses NextAuth.js. To set up authentication:

1. Generate a secret:
   ```bash
   openssl rand -base64 32
   ```

2. Update `.env`:
   ```bash
   NEXTAUTH_SECRET="your-generated-secret"
   ```

3. Configure auth providers in `src/server/auth.ts`

4. Default providers:
   - Email (magic link)
   - Google OAuth (configure in Google Cloud Console)

## ✅ Verification Checklist

After setup, verify:

- [ ] Database file created (`prisma/compliance-crm.db` or PostgreSQL connected)
- [ ] All tables visible in Prisma Studio
- [ ] 1 tenant exists
- [ ] 4 users created
- [ ] 15 leads with various statuses
- [ ] 4 compliance rules active
- [ ] 3 disclaimer templates
- [ ] Development server starts without errors
- [ ] Can access http://localhost:3000

## 🆘 Need Help?

- Check `docs/database-setup-guide.md` for detailed troubleshooting
- Review Prisma docs: https://www.prisma.io/docs
- Check Next.js docs: https://nextjs.org/docs

## 📝 Notes

- **Current Branch**: `claude/compliance-crm-insurance-01X7rGrpD1hXsbpiZBTKWCPV`
- **Database Provider**: SQLite (development), switch to PostgreSQL/MySQL for production
- **Sample Data**: All sample data uses realistic insurance industry scenarios
- **Compliance**: Built-in CMS Medicare compliance rules
