/**
 * Database Seed Script
 *
 * Populates the database with sample data for development and testing.
 * Creates a realistic insurance agency CRM environment.
 */

import { PrismaClient } from '@prisma/client';
import {
  UserRole,
  LeadStatus,
  LeadSource,
  TaskStatus,
  TaskPriority,
  SOAStatus,
  ComplianceRuleType,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clean existing data (optional - comment out to preserve data)
  console.log('🧹 Cleaning existing data...');
  await prisma.activity.deleteMany();
  await prisma.note.deleteMany();
  await prisma.task.deleteMany();
  await prisma.sOA.deleteMany();
  await prisma.complianceCheckRun.deleteMany();
  await prisma.disclaimerAcknowledgment.deleteMany();
  await prisma.callRecording.deleteMany();
  await prisma.callNote.deleteMany();
  await prisma.call.deleteMany();
  await prisma.contactInfo.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.disclaimerTemplate.deleteMany();
  await prisma.complianceRule.deleteMany();
  await prisma.dialerConfiguration.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // 1. Create Sample Tenant
  console.log('🏢 Creating sample tenant...');
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Medicare Solutions Agency',
      slug: 'medicare-solutions',
      email: 'contact@medicaresolutions.example.com',
      phone: '555-0100',
      address: '123 Insurance Plaza, Suite 500, New York, NY 10001',
      timezone: 'America/New_York',
      businessHours: {
        monday: { start: '08:00', end: '20:00' },
        tuesday: { start: '08:00', end: '20:00' },
        wednesday: { start: '08:00', end: '20:00' },
        thursday: { start: '08:00', end: '20:00' },
        friday: { start: '08:00', end: '20:00' },
        saturday: { start: '09:00', end: '17:00' },
      },
      planTier: 'professional',
      isActive: true,
    },
  });
  console.log(`✅ Created tenant: ${tenant.name} (${tenant.id})\n`);

  // 2. Create Users
  console.log('👥 Creating users...');

  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@medicaresolutions.example.com',
      name: 'Sarah Admin',
      role: UserRole.ADMIN,
      title: 'Agency Owner',
      phone: '555-0101',
      agentLicenseNumber: 'NY-ADM-12345',
      licenseState: 'NY',
      licenseExpiry: new Date('2025-12-31'),
      isActive: true,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'supervisor@medicaresolutions.example.com',
      name: 'Mike Supervisor',
      role: UserRole.SUPERVISOR,
      title: 'Team Lead',
      phone: '555-0102',
      agentLicenseNumber: 'NY-SUP-23456',
      licenseState: 'NY',
      licenseExpiry: new Date('2025-12-31'),
      isActive: true,
    },
  });

  const agent1 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'john.agent@medicaresolutions.example.com',
      name: 'John Agent',
      role: UserRole.AGENT,
      title: 'Senior Insurance Agent',
      phone: '555-0103',
      agentLicenseNumber: 'NY-AGT-34567',
      licenseState: 'NY',
      licenseExpiry: new Date('2025-12-31'),
      isActive: true,
    },
  });

  const agent2 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'emily.agent@medicaresolutions.example.com',
      name: 'Emily Agent',
      role: UserRole.AGENT,
      title: 'Insurance Agent',
      phone: '555-0104',
      agentLicenseNumber: 'NY-AGT-45678',
      licenseState: 'NY',
      licenseExpiry: new Date('2025-12-31'),
      isActive: true,
    },
  });

  console.log(`✅ Created 4 users (1 admin, 1 supervisor, 2 agents)\n`);

  // 3. Create Default Compliance Rules
  console.log('📋 Creating default compliance rules...');

  const dncRule = await prisma.complianceRule.create({
    data: {
      tenantId: tenant.id,
      name: 'Do Not Contact Check',
      description: 'Verify lead is not on internal or federal DNC list',
      ruleType: ComplianceRuleType.DNC_CHECK,
      config: {
        checkInternalDNC: true,
        checkFederalDNC: false, // Phase 2
      },
      isActive: true,
      isBlocking: true,
      priority: 100,
      createdBy: admin.id,
    },
  });

  const timeRule = await prisma.complianceRule.create({
    data: {
      tenantId: tenant.id,
      name: 'Calling Hours (CMS)',
      description: 'CMS requires calls between 8 AM and 9 PM in recipient timezone',
      ruleType: ComplianceRuleType.TIME_RESTRICTION,
      config: {
        allowedHours: { start: '08:00', end: '21:00' },
        timezone: 'lead',
        allowedDaysOfWeek: [1, 2, 3, 4, 5, 6], // Mon-Sat
      },
      isActive: true,
      isBlocking: true,
      priority: 90,
      createdBy: admin.id,
    },
  });

  const soaRule = await prisma.complianceRule.create({
    data: {
      tenantId: tenant.id,
      name: 'SOA Requirement',
      description: 'Scope of Appointment required for Medicare products',
      ruleType: ComplianceRuleType.SOA_REQUIREMENT,
      config: {
        requiredForProducts: ['Medicare Advantage', 'Medicare Supplement', 'Part D'],
        expirationDays: 30,
        allowExpiredWithWarning: false,
      },
      isActive: true,
      isBlocking: true,
      priority: 95,
      createdBy: admin.id,
    },
  });

  const recordingRule = await prisma.complianceRule.create({
    data: {
      tenantId: tenant.id,
      name: 'Call Recording',
      description: 'All Medicare sales calls must be recorded',
      ruleType: ComplianceRuleType.RECORDING,
      config: {
        requireRecording: true,
        recordingRetentionDays: 2555, // 7 years
        allowProceedWithoutRecording: false,
      },
      isActive: true,
      isBlocking: false,
      priority: 50,
      createdBy: admin.id,
    },
  });

  console.log(`✅ Created 4 compliance rules\n`);

  // 4. Create Required Disclaimers
  console.log('📢 Creating required disclaimers...');

  const govDisclaimer = await prisma.disclaimerTemplate.create({
    data: {
      tenantId: tenant.id,
      name: 'Government Non-Affiliation',
      description: 'CMS-required disclaimer about government affiliation',
      text: 'We do not offer every plan available in your area. Any information we provide is limited to those plans we do offer in your area. Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options.',
      isRequired: true,
      isActive: true,
      appliesTo: {
        productTypes: ['Medicare Advantage', 'Medicare Supplement', 'Part D'],
      },
    },
  });

  const notEndorsedDisclaimer = await prisma.disclaimerTemplate.create({
    data: {
      tenantId: tenant.id,
      name: 'Not Government Endorsed',
      description: 'Clarifies not endorsed by federal Medicare program',
      text: 'This is not connected with or endorsed by the United States government or the federal Medicare program.',
      isRequired: true,
      isActive: true,
      appliesTo: {
        productTypes: ['Medicare Advantage', 'Medicare Supplement', 'Part D'],
      },
    },
  });

  const planAvailabilityDisclaimer = await prisma.disclaimerTemplate.create({
    data: {
      tenantId: tenant.id,
      name: 'Plan Availability',
      description: 'Discloses limited plan offerings',
      text: 'Plans are insured through private insurance companies. Plan availability varies by region and carrier.',
      isRequired: true,
      isActive: true,
    },
  });

  console.log(`✅ Created 3 disclaimer templates\n`);

  // 5. Create Dialer Configuration
  console.log('📞 Creating dialer configuration...');

  const dialerConfig = await prisma.dialerConfiguration.create({
    data: {
      tenantId: tenant.id,
      dialerType: 'ENROLL_HERE',
      name: 'EnrollHere Production',
      apiKey: 'demo_api_key_12345',
      baseUrl: 'https://api.enrollhere.com',
      webhookSecret: 'demo_webhook_secret_67890',
      isActive: true,
      isPrimary: true,
    },
  });

  console.log(`✅ Created dialer configuration\n`);

  // 6. Create Sample Leads
  console.log('👤 Creating sample leads...');

  const leads = [];

  // Lead 1: New lead, just created
  const lead1 = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Robert',
      lastName: 'Johnson',
      email: 'robert.j@example.com',
      status: LeadStatus.NEW,
      source: LeadSource.WEB_FORM,
      assignedTo: agent1.id,
      createdBy: admin.id,
      dateOfBirth: new Date('1950-03-15'),
      isCurrentlyInsured: false,
      tags: 'senior,medicare-eligible,web-lead',
      contactInfo: {
        create: [
          {
            type: 'phone',
            value: '555-1001',
            isPrimary: true,
            isMobile: true,
          },
          {
            type: 'email',
            value: 'robert.j@example.com',
            isPrimary: true,
          },
        ],
      },
    },
  });
  leads.push(lead1);

  // Lead 2: Contacted, has SOA
  const lead2 = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Margaret',
      lastName: 'Williams',
      email: 'margaret.w@example.com',
      status: LeadStatus.SOA_SIGNED,
      source: LeadSource.REFERRAL,
      assignedTo: agent1.id,
      createdBy: agent1.id,
      dateOfBirth: new Date('1948-07-22'),
      isCurrentlyInsured: true,
      currentCarrier: 'United Healthcare',
      lastContactedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      nextFollowUpAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      tags: 'senior,has-soa,warm-lead',
      contactInfo: {
        create: [
          {
            type: 'phone',
            value: '555-1002',
            isPrimary: true,
            isMobile: false,
          },
        ],
      },
    },
  });
  leads.push(lead2);

  // Create SOA for lead2
  await prisma.sOA.create({
    data: {
      leadId: lead2.id,
      tenantId: tenant.id,
      status: SOAStatus.SIGNED,
      productsDiscussed: 'Medicare Advantage, Part D',
      captureMethod: 'Electronic',
      signedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      createdBy: agent1.id,
    },
  });

  // Lead 3: Do Not Contact
  const lead3 = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Richard',
      lastName: 'Davis',
      email: 'richard.d@example.com',
      status: LeadStatus.DO_NOT_CONTACT,
      source: LeadSource.PURCHASED_LIST,
      assignedTo: agent2.id,
      createdBy: agent2.id,
      isDNC: true,
      dncReason: 'Requested removal from all marketing communications',
      dncDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      contactInfo: {
        create: [
          {
            type: 'phone',
            value: '555-1003',
            isPrimary: true,
            isMobile: true,
          },
        ],
      },
    },
  });
  leads.push(lead3);

  // Lead 4: Qualified, appointment set
  const lead4 = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Linda',
      lastName: 'Martinez',
      email: 'linda.m@example.com',
      status: LeadStatus.APPOINTMENT_SET,
      source: LeadSource.INBOUND_CALL,
      assignedTo: agent1.id,
      createdBy: agent1.id,
      dateOfBirth: new Date('1952-11-08'),
      isCurrentlyInsured: true,
      currentCarrier: 'Aetna',
      lastContactedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      nextFollowUpAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      tags: 'senior,appointment-scheduled,hot-lead',
      contactInfo: {
        create: [
          {
            type: 'phone',
            value: '555-1004',
            isPrimary: true,
            isMobile: true,
          },
        ],
      },
    },
  });
  leads.push(lead4);

  // Lead 5: Not interested
  const lead5 = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      firstName: 'James',
      lastName: 'Anderson',
      status: LeadStatus.NOT_INTERESTED,
      source: LeadSource.EMAIL_CAMPAIGN,
      assignedTo: agent2.id,
      createdBy: agent2.id,
      lastContactedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      contactInfo: {
        create: [
          {
            type: 'phone',
            value: '555-1005',
            isPrimary: true,
            isMobile: false,
          },
        ],
      },
    },
  });
  leads.push(lead5);

  // Create 10 more leads with varying statuses
  const firstNames = ['Patricia', 'Michael', 'Jennifer', 'William', 'Elizabeth', 'David', 'Susan', 'Joseph', 'Jessica', 'Charles'];
  const lastNames = ['Taylor', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Robinson'];
  const statuses = [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.CALLBACK, LeadStatus.NURTURE];
  const sources = [LeadSource.WEB_FORM, LeadSource.INBOUND_CALL, LeadSource.REFERRAL, LeadSource.SOCIAL_MEDIA];

  for (let i = 0; i < 10; i++) {
    const lead = await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        firstName: firstNames[i],
        lastName: lastNames[i],
        email: `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}@example.com`,
        status: statuses[i % statuses.length],
        source: sources[i % sources.length],
        assignedTo: i % 2 === 0 ? agent1.id : agent2.id,
        createdBy: i % 2 === 0 ? agent1.id : agent2.id,
        dateOfBirth: new Date(1945 + Math.floor(Math.random() * 15), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        contactInfo: {
          create: [
            {
              type: 'phone',
              value: `555-10${10 + i}`,
              isPrimary: true,
              isMobile: i % 2 === 0,
            },
          ],
        },
      },
    });
    leads.push(lead);
  }

  console.log(`✅ Created ${leads.length} sample leads\n`);

  // 7. Create Tasks
  console.log('✅ Creating tasks...');

  // Overdue task
  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      leadId: lead1.id,
      assignedTo: agent1.id,
      createdBy: agent1.id,
      title: 'Follow up on Medicare interest',
      description: 'Lead expressed interest in Medicare Advantage plans',
      status: TaskStatus.PENDING,
      priority: TaskPriority.HIGH,
      dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (overdue)
    },
  });

  // Due today
  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      leadId: lead2.id,
      assignedTo: agent1.id,
      createdBy: agent1.id,
      title: 'Send plan comparison document',
      description: 'Send Medicare Advantage vs Supplement comparison',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      dueAt: new Date(), // Today
    },
  });

  // Future task
  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      leadId: lead4.id,
      assignedTo: agent1.id,
      createdBy: agent1.id,
      title: 'Appointment: Review plan options',
      description: 'Scheduled appointment to review Medicare options',
      status: TaskStatus.PENDING,
      priority: TaskPriority.URGENT,
      dueAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
    },
  });

  // Completed task
  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      leadId: lead2.id,
      assignedTo: agent1.id,
      createdBy: agent1.id,
      title: 'Obtain Scope of Appointment',
      description: 'Get SOA signed for Medicare products',
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      dueAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`✅ Created 4 tasks\n`);

  // 8. Create Notes
  console.log('📝 Creating notes...');

  await prisma.note.create({
    data: {
      tenantId: tenant.id,
      leadId: lead1.id,
      userId: agent1.id,
      content: 'Lead called asking about Medicare Advantage options. Interested in plans with dental coverage. Scheduled follow-up for next week.',
      isPinned: true,
    },
  });

  await prisma.note.create({
    data: {
      tenantId: tenant.id,
      leadId: lead2.id,
      userId: agent1.id,
      content: 'SOA obtained successfully. Lead prefers lower premiums over lower deductibles. Currently with UnitedHealthcare but open to switching.',
      isPinned: false,
    },
  });

  await prisma.note.create({
    data: {
      tenantId: tenant.id,
      leadId: lead4.id,
      userId: agent1.id,
      content: 'Very motivated buyer. Turning 65 next month. Wants to compare at least 3 plans before making decision.',
      isPinned: true,
    },
  });

  console.log(`✅ Created 3 notes\n`);

  // 9. Create Activities
  console.log('📊 Creating activities...');

  await prisma.activity.create({
    data: {
      tenantId: tenant.id,
      leadId: lead1.id,
      userId: agent1.id,
      type: 'lead_created',
      description: 'Lead created from web form submission',
      metadata: { source: 'WEB_FORM' },
    },
  });

  await prisma.activity.create({
    data: {
      tenantId: tenant.id,
      leadId: lead2.id,
      userId: agent1.id,
      type: 'status_changed',
      description: 'Status changed from CONTACTED to SOA_SIGNED',
      metadata: { oldStatus: 'CONTACTED', newStatus: 'SOA_SIGNED' },
    },
  });

  await prisma.activity.create({
    data: {
      tenantId: tenant.id,
      leadId: lead2.id,
      userId: agent1.id,
      type: 'soa_captured',
      description: 'Scope of Appointment obtained',
      metadata: { products: 'Medicare Advantage, Part D', method: 'Electronic' },
    },
  });

  console.log(`✅ Created 3 activities\n`);

  // Summary
  console.log('═══════════════════════════════════════');
  console.log('✅ Database seeded successfully!');
  console.log('═══════════════════════════════════════\n');
  console.log('📊 Summary:');
  console.log(`  • Tenant: ${tenant.name}`);
  console.log(`  • Users: 4 (1 admin, 1 supervisor, 2 agents)`);
  console.log(`  • Leads: ${leads.length}`);
  console.log(`  • Compliance Rules: 4`);
  console.log(`  • Disclaimers: 3`);
  console.log(`  • Tasks: 4 (1 overdue, 1 due today)`);
  console.log(`  • Notes: 3`);
  console.log(`  • SOAs: 1`);
  console.log('\n🔐 Test Credentials:');
  console.log('  Admin:      admin@medicaresolutions.example.com');
  console.log('  Supervisor: supervisor@medicaresolutions.example.com');
  console.log('  Agent 1:    john.agent@medicaresolutions.example.com');
  console.log('  Agent 2:    emily.agent@medicaresolutions.example.com');
  console.log('\n🎯 Ready to test the CRM!');
  console.log('═══════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
