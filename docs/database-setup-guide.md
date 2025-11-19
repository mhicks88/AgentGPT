# Database Setup Guide

## Current Status

### ✅ Completed

1. **Database Schema**: Complete Prisma schema created (`prisma/schema.prisma`)
   - 25+ tables with full relationships
   - Multi-tenant architecture
   - Compliance models (SOA, Rules, Disclaimers)
   - Audit logging
   - CRM core (Leads, Tasks, Notes)

2. **Seed Script**: Comprehensive seed data created (`prisma/seed.ts`)
   - Sample tenant (Medicare Solutions Agency)
   - 4 users (admin, supervisor, 2 agents)
   - 4 compliance rules (DNC, time restrictions, SOA, recording)
   - 3 disclaimer templates
   - 15 sample leads
   - Tasks, notes, activities, and 1 signed SOA

3. **SQL Schema File**: Manual SQLite schema (`prisma/manual-setup.sql`)
   - Fallback for environments with Prisma engine restrictions

4. **Package Configuration**: Updated `package.json` with database scripts
   - `npm run db:migrate` - Run Prisma migrations
   - `npm run db:push` - Push schema to database
   - `npm run db:seed` - Seed database with sample data
   - `npm run db:studio` - Open Prisma Studio

### ⚠️ Blocker: Environment Restrictions

The current environment has network restrictions preventing:
- Downloading Prisma engines (403 Forbidden on binaries.prisma.sh)
- No PostgreSQL server running
- No MySQL available
- No SQLite3 CLI tool installed

## Setup Options

### Option 1: Local Development (Recommended)

If you're running this project locally, you can set up the database easily:

#### Using SQLite (Simplest)

```bash
# 1. Ensure .env is configured
cp .env.example .env
# DATABASE_URL is already set to: file:./prisma/compliance-crm.db

# 2. Install dependencies
npm install

# 3. Push schema to database (creates the DB file)
npm run db:push

# 4. Seed the database
npm run db:seed

# 5. Verify setup
npm run db:studio
# Opens Prisma Studio at http://localhost:5555
```

#### Using PostgreSQL (Production-like)

```bash
# 1. Start PostgreSQL (if using Docker)
docker run -d \
  --name compliance-crm-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=compliance_crm \
  -p 5432:5432 \
  postgres:16

# 2. Update .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/compliance_crm"

# 3. Update prisma/schema.prisma datasource
# Change: provider = "sqlite"
# To:     provider = "postgresql"

# 4. Install and setup
npm install
npm run db:push
npm run db:seed
```

#### Using MySQL

```bash
# 1. Start MySQL (if using Docker)
docker run -d \
  --name compliance-crm-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=compliance_crm \
  -p 3306:3306 \
  mysql:8

# 2. Update .env
DATABASE_URL="mysql://root:root@localhost:3306/compliance_crm"

# 3. Update prisma/schema.prisma datasource
# Change: provider = "sqlite"
# To:     provider = "mysql"
# Add:    relationMode = "prisma"

# 4. Install and setup
npm install
npm run db:push
npm run db:seed
```

### Option 2: Cloud Environment Setup

If deploying to a cloud environment (Vercel, Railway, Fly.io, etc.):

#### Vercel + PlanetScale/Neon

```bash
# 1. Create database on PlanetScale or Neon
# Get connection string from dashboard

# 2. Add to Vercel environment variables
DATABASE_URL="mysql://user:pass@host/database?sslaccept=strict"
# or
DATABASE_URL="postgresql://user:pass@host/database?sslmode=require"

# 3. Update schema provider accordingly

# 4. Deploy - Vercel will run postinstall (prisma generate) automatically

# 5. Run migration from local
npx prisma db push

# 6. Seed the database
npx tsx prisma/seed.ts
```

#### Railway

```bash
# 1. Create PostgreSQL database in Railway dashboard
# Copy DATABASE_URL from variables tab

# 2. Update local .env with Railway DATABASE_URL

# 3. Run migrations locally (Railway doesn't support prisma CLI in build)
npm run db:push

# 4. Seed
npm run db:seed

# 5. Deploy
git push railway main
```

### Option 3: Manual SQL Setup (Current Environment)

If you need to set up in an environment with restrictions:

```bash
# 1. If SQLite3 is available
sqlite3 prisma/compliance-crm.db < prisma/manual-setup.sql

# 2. Then manually run seed data SQL (would need to be generated)
# or write a Node.js script that uses better-sqlite3 package
```

## Verification Steps

After database setup, verify it works:

```bash
# 1. Check tables were created
npm run db:studio
# Should show all 25+ tables

# 2. Verify seed data
# - Should see 1 tenant
# - Should see 4 users
# - Should see 15 leads
# - Should see 4 compliance rules
# - Should see 3 disclaimers

# 3. Test API (after starting dev server)
npm run dev
# Open http://localhost:3000
```

## Next Steps After Database Setup

Once the database is set up and seeded:

1. **Test API Endpoints**: Use Prisma Studio or write integration tests
2. **Build Frontend Pages**: Lead list, lead detail, task dashboard
3. **Implement Call Flow UI**: Pre-call check, in-call script, post-call form
4. **Add Dialer Integration**: Connect to EnrollHere or test dialer
5. **Create Admin Settings**: Compliance rules, disclaimers, user management

## Troubleshooting

### Error: "Can't reach database server"

- Ensure database is running
- Check DATABASE_URL connection string
- Verify network access and firewall rules

### Error: "Migration failed"

- Try `npm run db:push` instead of `db:migrate` for development
- Check schema syntax
- Ensure provider matches database type

### Error: "Prisma generate failed"

- Network restrictions downloading engines
- Try setting: `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`
- Or use local Prisma installation

### Seed Script Errors

- Ensure database schema is created first (`db:push`)
- Check for duplicate data if re-running seed
- Clear database: delete `prisma/compliance-crm.db` and run `db:push` again

## Database Schema Overview

```
Tenants (1)
└── Users (4)
    ├── Admin (Sarah Johnson)
    ├── Supervisor (Mike Thompson)
    ├── Agent (Emily Rodriguez)
    └── Agent (David Chen)

Leads (15)
├── NEW (5)
├── CONTACTED (3)
├── QUALIFIED (2)
├── SOA_SIGNED (2)
├── DO_NOT_CONTACT (2)
└── LOST (1)

Compliance
├── Rules (4): DNC, Time, SOA, Recording
├── Disclaimers (3): Government, Non-endorsement, Recording
└── Check Runs (auto-generated)

CRM Data
├── Tasks (4)
├── Notes (3)
└── Activities (3)
```

## Environment Variables Reference

```bash
# Required
DATABASE_URL="file:./prisma/compliance-crm.db"  # SQLite
# or
DATABASE_URL="postgresql://user:pass@host:5432/db"  # PostgreSQL
# or
DATABASE_URL="mysql://user:pass@host:3306/db"  # MySQL

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Optional (for production)
OPENAI_API_KEY="sk-..."
```
