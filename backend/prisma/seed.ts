// Seed script for Prisma 7
// Load .env file FIRST before any imports
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Import PrismaClient AFTER environment is loaded
import { PrismaClient, Role, ShipmentStatus, ServiceLevel, ScanType, VehicleType, IssueType, AggregationType, MetricDimension, AgentChannel, ContactType, RouteStatus, IssueStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Verify DATABASE_URL is loaded and ensure it's in process.env
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found!');
  console.error('Make sure .env file exists in backend/ directory with DATABASE_URL');
  process.exit(1);
}

// Ensure DATABASE_URL is explicitly set in process.env
// Prisma 7 reads from process.env.DATABASE_URL automatically
process.env.DATABASE_URL = dbUrl;

console.log('DATABASE_URL loaded:', dbUrl.replace(/:([^:@]+)@/, ':****@'));

// Prisma 7: Requires adapter when using engine type "client"
// Install and use PostgreSQL adapter
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({
  connectionString: dbUrl,
});

const adapter = new PrismaPg(pool);

// Prisma 7: Pass adapter to PrismaClient constructor
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');
  
  // Clear existing data (in reverse order of dependencies)
  console.log('Clearing existing data...');
  await prisma.routeStop.deleteMany();
  await prisma.shipmentScan.deleteMany();
  await prisma.escalationLog.deleteMany();
  await prisma.acknowledgment.deleteMany();
  await prisma.route.deleteMany();
  await prisma.deliveryIssue.deleteMany();
  await prisma.escalationContact.deleteMany();
  await prisma.agentSession.deleteMany();
  await prisma.metricSnapshot.deleteMany();
  await prisma.metricDefinition.deleteMany();
  await prisma.dashboardConfig.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.dispatcherProfile.deleteMany(); // Delete before User (foreign key constraint)
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();
  console.log('Cleared existing data');
  
  const password = await bcrypt.hash('password123', 10);

  // 1. Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@callsphere.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@callsphere.com',
      password, 
      role: Role.admin,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@callsphere.com' },
    update: {},
    create: {
      name: 'Manager User',
      email: 'manager@callsphere.com',
      password,
      role: Role.manager,
    },
  });

  const dispatcher = await prisma.user.upsert({
    where: { email: 'dispatch@callsphere.com' },
    update: {},
    create: {
      name: 'Dispatcher User',
      email: 'dispatch@callsphere.com',
      password,
      role: Role.dispatcher,
    },
  });

  // Create dispatcher profile with assigned region
  const dispatcherProfile = await prisma.dispatcherProfile.upsert({
    where: { userId: dispatcher.id },
    update: {},
    create: {
      userId: dispatcher.id,
      dispatcherCode: 'DISP-001',
      assignedRegion: 'NY-Depot', // Assign to NY region (can have multiple dispatchers per region)
    },
  });

  // Create multiple drivers
  const driver1 = await prisma.user.upsert({
    where: { email: 'driver1@callsphere.com' },
    update: {},
    create: {
      name: 'Driver Dave',
      email: 'driver1@callsphere.com',
      password,
      role: Role.driver,
    },
  });

  const driver2 = await prisma.user.upsert({
    where: { email: 'driver2@callsphere.com' },
    update: {},
    create: {
      name: 'Driver John',
      email: 'driver2@callsphere.com',
      password,
      role: Role.driver,
    },
  });

  const driver3 = await prisma.user.upsert({
    where: { email: 'driver3@callsphere.com' },
    update: {},
    create: {
      name: 'Driver Sarah',
      email: 'driver3@callsphere.com',
      password,
      role: Role.driver,
    },
  });

  // Create multiple customers
  const customer1 = await prisma.user.upsert({
    where: { email: 'customer@gmail.com' },
    update: {},
    create: {
      name: 'Alice Customer',
      email: 'customer@gmail.com',
      password,
      role: Role.customer,
    },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: 'bob.customer@email.com' },
    update: {},
    create: {
      name: 'Bob Customer',
      email: 'bob.customer@email.com',
      password,
      role: Role.customer,
    },
  });

  const customer3 = await prisma.user.upsert({
    where: { email: 'charlie.customer@email.com' },
    update: {},
    create: {
      name: 'Charlie Customer',
      email: 'charlie.customer@email.com',
      password,
      role: Role.customer,
    },
  });

  const customer4 = await prisma.user.upsert({
    where: { email: 'diana.customer@email.com' },
    update: {},
    create: {
      name: 'Diana Customer',
      email: 'diana.customer@email.com',
      password,
      role: Role.customer,
    },
  });

  const customer5 = await prisma.user.upsert({
    where: { email: 'eve.customer@email.com' },
    update: {},
    create: {
      name: 'Eve Customer',
      email: 'eve.customer@email.com',
      password,
      role: Role.customer,
    },
  });

  // 2. Vehicles & Drivers
  const vehicle1 = await prisma.vehicle.upsert({
    where: { vehicleCode: 'VAN-001' },
    update: {},
    create: {
      vehicleCode: 'VAN-001',
      capacityVolume: 100,
      capacityWeight: 1000,
      homeBase: 'NY-Depot',
      vehicleType: VehicleType.van,
    },
  });

  const vehicle2 = await prisma.vehicle.upsert({
    where: { vehicleCode: 'VAN-002' },
    update: {},
    create: {
      vehicleCode: 'VAN-002',
      capacityVolume: 120,
      capacityWeight: 1200,
      homeBase: 'CA-Depot',
      vehicleType: VehicleType.van,
    },
  });

  const vehicle3 = await prisma.vehicle.upsert({
    where: { vehicleCode: 'TRK-001' },
    update: {},
    create: {
      vehicleCode: 'TRK-001',
      capacityVolume: 200,
      capacityWeight: 2000,
      homeBase: 'TX-Depot',
      vehicleType: VehicleType.truck,
    },
  });

  const driverProfile1 = await prisma.driver.upsert({
    where: { userId: driver1.id },
    update: {},
    create: {
      userId: driver1.id,
      driverCode: 'DRV-001',
      homeBase: 'NY-Depot',
      assignedVehicleId: vehicle1.id,
    },
  });

  const driverProfile2 = await prisma.driver.upsert({
    where: { userId: driver2.id },
    update: {},
    create: {
      userId: driver2.id,
      driverCode: 'DRV-002',
      homeBase: 'CA-Depot',
      assignedVehicleId: vehicle2.id,
    },
  });

  const driverProfile3 = await prisma.driver.upsert({
    where: { userId: driver3.id },
    update: {},
    create: {
      userId: driver3.id,
      driverCode: 'DRV-003',
      homeBase: 'TX-Depot',
      assignedVehicleId: vehicle3.id,
    },
  });

  // 3. Metric Definitions
  const onTimeMetric = await prisma.metricDefinition.upsert({
    where: { key: 'on_time_delivery_rate' },
    update: {},
    create: {
      key: 'on_time_delivery_rate',
      name: 'On-Time Delivery Rate',
      description: 'Percentage of shipments delivered on or before promised delivery date',
      aggregationType: AggregationType.ratio,
      dimension: MetricDimension.global,
      targetValue: 95.0,
      warningThreshold: 90.0,
      criticalThreshold: 85.0,
    },
  });

  await prisma.metricDefinition.upsert({
    where: { key: 'first_attempt_success_rate' },
    update: {},
    create: {
      key: 'first_attempt_success_rate',
      name: 'First Attempt Success Rate',
      description: 'Percentage of deliveries successful on first attempt',
      aggregationType: AggregationType.ratio,
      dimension: MetricDimension.global,
      targetValue: 90.0,
      warningThreshold: 85.0,
      criticalThreshold: 80.0,
    },
  });

  await prisma.metricDefinition.upsert({
    where: { key: 'open_issues_count' },
    update: {},
    create: {
      key: 'open_issues_count',
      name: 'Open Issues Count',
      description: 'Total number of open delivery issues',
      aggregationType: AggregationType.count,
      dimension: MetricDimension.global,
      targetValue: 0,
      warningThreshold: 10,
      criticalThreshold: 25,
    },
  });

  await prisma.metricDefinition.upsert({
    where: { key: 'sla_risk_count' },
    update: {},
    create: {
      key: 'sla_risk_count',
      name: 'SLA Risk Count',
      description: 'Number of shipments at risk of missing SLA',
      aggregationType: AggregationType.count,
      dimension: MetricDimension.global,
      targetValue: 0,
      warningThreshold: 5,
      criticalThreshold: 15,
    },
  });

  // 4. Generate 40 shipments with various statuses, scans, and details
  const customers = [customer1, customer2, customer3, customer4, customer5];
  const statuses = [
    ShipmentStatus.PENDING,
    ShipmentStatus.picked_up,
    ShipmentStatus.in_transit,
    ShipmentStatus.out_for_delivery,
    ShipmentStatus.delivered,
    ShipmentStatus.failed,
  ];
  const serviceLevels = [ServiceLevel.standard, ServiceLevel.express, ServiceLevel.same_day];
  const regions = ['NY-Depot', 'CA-Depot', 'TX-Depot', 'FL-Depot'];
  const addresses = [
    { from: '123 Sender St, New York, NY 10001', to: '456 Receiver Ave, New York, NY 10002' },
    { from: '789 Sender Blvd, Los Angeles, CA 90001', to: '321 Receiver St, Los Angeles, CA 90002' },
    { from: '555 Sender Dr, Houston, TX 77001', to: '888 Receiver Ln, Houston, TX 77002' },
    { from: '111 Sender Ave, Miami, FL 33101', to: '222 Receiver Rd, Miami, FL 33102' },
  ];

  const shipments = [];
  const now = new Date();

  for (let i = 1; i <= 40; i++) {
    const customer = customers[i % customers.length];
    const status = statuses[i % statuses.length];
    const serviceLevel = serviceLevels[i % serviceLevels.length];
    const addressPair = addresses[i % addresses.length];
    const isVip = i % 7 === 0; // Every 7th shipment is VIP
    
    // Calculate promised delivery date (1-7 days from now)
    const daysUntilDelivery = Math.floor(Math.random() * 7) + 1;
    const promisedDeliveryDate = new Date(now.getTime() + daysUntilDelivery * 86400000);
    
    // Calculate SLA risk score based on status and time
    let slaRiskScore = 0.0;
    if (status === ShipmentStatus.in_transit || status === ShipmentStatus.out_for_delivery) {
      const hoursUntilDelivery = (promisedDeliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilDelivery < 24) slaRiskScore = 0.7 + (24 - hoursUntilDelivery) / 24 * 0.3;
      else if (hoursUntilDelivery < 48) slaRiskScore = 0.4 + (48 - hoursUntilDelivery) / 24 * 0.3;
    }
    if (isVip) slaRiskScore = Math.min(slaRiskScore + 0.1, 1.0);
    
    // Generate scans based on status
    const scans = [];
    let lastScanAt = null;
    let lastScanLocation = null;
    
    if (status !== ShipmentStatus.PENDING) {
      scans.push({
        scanType: ScanType.pickup,
        location: addressPair.from,
        timestamp: new Date(now.getTime() - (daysUntilDelivery * 86400000) - (Math.random() * 2 + 1) * 86400000),
        notes: 'Picked up from warehouse',
      });
      lastScanAt = scans[scans.length - 1].timestamp;
      lastScanLocation = addressPair.from;
    }
    
    if (status !== ShipmentStatus.PENDING && status !== ShipmentStatus.picked_up && lastScanAt) {
      scans.push({
        scanType: ScanType.depot_checkin,
        location: regions[i % regions.length],
        timestamp: new Date(lastScanAt.getTime() + 3600000 * (Math.random() * 6 + 2)),
        notes: 'Arrived at depot',
      });
      lastScanAt = scans[scans.length - 1].timestamp;
      lastScanLocation = regions[i % regions.length];
    }
    
    if ((status === ShipmentStatus.in_transit || status === ShipmentStatus.out_for_delivery || 
        status === ShipmentStatus.delivered || status === ShipmentStatus.failed) && lastScanAt) {
      scans.push({
        scanType: ScanType.depot_checkout,
        location: regions[i % regions.length],
        timestamp: new Date(lastScanAt.getTime() + 3600000 * (Math.random() * 12 + 4)),
        notes: 'Departed from depot',
      });
      lastScanAt = scans[scans.length - 1].timestamp;
      lastScanLocation = regions[i % regions.length];
    }
    
    if ((status === ShipmentStatus.out_for_delivery || status === ShipmentStatus.delivered || 
        status === ShipmentStatus.failed) && lastScanAt) {
      scans.push({
        scanType: ScanType.out_for_delivery,
        location: addressPair.to.split(',')[0] + ' Area',
        timestamp: new Date(lastScanAt.getTime() + 3600000 * (Math.random() * 4 + 2)),
        notes: 'Out for delivery',
      });
      lastScanAt = scans[scans.length - 1].timestamp;
      lastScanLocation = addressPair.to.split(',')[0] + ' Area';
    }
    
    if (status === ShipmentStatus.delivered && lastScanAt) {
      scans.push({
        scanType: ScanType.delivered,
        location: addressPair.to,
        timestamp: new Date(lastScanAt.getTime() + 3600000 * (Math.random() * 2 + 0.5)),
        notes: 'Delivered successfully',
      });
      lastScanAt = scans[scans.length - 1].timestamp;
      lastScanLocation = addressPair.to;
    } else if (status === ShipmentStatus.failed && lastScanAt) {
      scans.push({
        scanType: ScanType.failed_attempt,
        location: addressPair.to,
        timestamp: new Date(lastScanAt.getTime() + 3600000 * (Math.random() * 2 + 0.5)),
        notes: 'Delivery attempt failed - recipient not available',
      });
      lastScanAt = scans[scans.length - 1].timestamp;
      lastScanLocation = addressPair.to;
    }

    const shipment = await prisma.shipment.create({
      data: {
        trackingNumber: `TRK-${1000000 + i}`,
        orderId: `ORD-${2000000 + i}`,
        customerId: customer.id,
        fromAddress: addressPair.from,
        toAddress: addressPair.to,
        currentStatus: status,
        serviceLevel,
        promisedDeliveryDate,
        lastScanAt,
        lastScanLocation,
        isVip,
        slaRiskScore: Number(slaRiskScore.toFixed(2)),
        scans: {
          create: scans,
        },
      },
    });

    shipments.push(shipment);
  }

  console.log(`Created ${shipments.length} shipments`);

  // 5. Create 12 routes with route stops
  const routes = [];
  const routeStatuses = [RouteStatus.planned, RouteStatus.active, RouteStatus.completed];
  const routeDate = new Date();
  
  for (let i = 1; i <= 12; i++) {
    const driverProfile = [driverProfile1, driverProfile2, driverProfile3][i % 3];
    const vehicle = [vehicle1, vehicle2, vehicle3][i % 3];
    const region = regions[i % regions.length];
    const status = routeStatuses[i % routeStatuses.length];
    
    // Route date: some past, some today, some future
    const routeDateOffset = i <= 4 ? -i : (i <= 8 ? 0 : i - 8);
    const routeDateForRoute = new Date(routeDate);
    routeDateForRoute.setDate(routeDateForRoute.getDate() + routeDateOffset);
    routeDateForRoute.setHours(0, 0, 0, 0);

    const route = await prisma.route.create({
      data: {
        routeCode: `ROUTE-${String(i).padStart(3, '0')}`,
        date: routeDateForRoute,
        driverId: driverProfile.id,
        vehicleId: vehicle.id,
        region,
        status,
      },
    });

    routes.push(route);

    // Create route stops for this route (5-8 stops per route)
    const stopsCount = Math.floor(Math.random() * 4) + 5;
    const routeShipments = shipments.slice((i - 1) * 3, (i - 1) * 3 + stopsCount);
    
    for (let j = 0; j < routeShipments.length; j++) {
      const shipment = routeShipments[j];
      if (!shipment) break;

      const plannedEta = new Date(routeDateForRoute);
      plannedEta.setHours(8 + j * 1.5 + Math.random() * 0.5, Math.floor(Math.random() * 60), 0, 0);
      
      let actualArrival = null;
      let stopStatus = null;
      
      if (status === RouteStatus.active || status === RouteStatus.completed) {
        actualArrival = new Date(plannedEta);
        actualArrival.setMinutes(actualArrival.getMinutes() + Math.floor(Math.random() * 30) - 15);
        
        if (status === RouteStatus.completed) {
          stopStatus = shipment.currentStatus === ShipmentStatus.delivered ? 'completed' : 
                       shipment.currentStatus === ShipmentStatus.failed ? 'failed' : 'pending';
        }
      }

      await prisma.routeStop.create({
        data: {
          routeId: route.id,
          shipmentId: shipment.id,
          sequenceNumber: j + 1,
          plannedEta,
          actualArrival,
          status: stopStatus,
        },
      });
    }
  }

  console.log(`Created ${routes.length} routes with stops`);

  // 6. Create 8 delivery issues with various types and severities
  const issueTypes = [
    IssueType.damaged,
    IssueType.missing,
    IssueType.wrong_address,
    IssueType.missed_delivery,
    IssueType.delay,
    IssueType.other,
  ];
  const issueStatuses = [IssueStatus.open, IssueStatus.investigating, IssueStatus.resolved, IssueStatus.closed];
  const issueDescriptions = [
    'Package arrived with visible damage to the box',
    'Item missing from the package',
    'Package delivered to wrong address',
    'Delivery attempted but recipient was not available',
    'Shipment delayed beyond promised delivery date',
    'Package was returned to sender',
    'Customs clearance issue causing delay',
    'Address label was unreadable',
  ];

  const issues = [];
  for (let i = 0; i < 8; i++) {
    const shipment = shipments[i * 5]; // Spread issues across shipments
    const issueType = issueTypes[i % issueTypes.length];
    const status = issueStatuses[i % issueStatuses.length];
    const severityScore = 0.3 + (i % 7) * 0.1; // 0.3 to 0.9
    
    const issue = await prisma.deliveryIssue.create({
      data: {
        shipmentId: shipment.id,
        reportedByUserId: shipment.customerId,
        issueType,
        description: issueDescriptions[i % issueDescriptions.length],
        aiSeverityScore: Number(severityScore.toFixed(2)),
        status,
        resolutionNotes: status === IssueStatus.resolved || status === IssueStatus.closed ? 
          `Issue resolved on ${new Date().toISOString()}` : null,
      },
    });

    issues.push(issue);
  }

  console.log(`Created ${issues.length} delivery issues`);

  // 7. Create escalation contacts
  const escalationContacts = [];
  
  // Manager contacts
  const managerContact1 = await prisma.escalationContact.create({
    data: {
      userId: manager.id,
      position: 'Shift Manager',
      contactType: ContactType.email,
      timeoutSeconds: 300, // 5 minutes
      isActive: true,
    },
  });
  escalationContacts.push(managerContact1);

  const managerContact2 = await prisma.escalationContact.create({
    data: {
      userId: manager.id,
      position: 'Operations Manager',
      contactType: ContactType.phone,
      timeoutSeconds: 600, // 10 minutes
      isActive: true,
    },
  });
  escalationContacts.push(managerContact2);

  // Dispatcher contacts
  const dispatcherContact1 = await prisma.escalationContact.create({
    data: {
      userId: dispatcher.id,
      position: 'Senior Dispatcher',
      contactType: ContactType.slack,
      timeoutSeconds: 180, // 3 minutes
      isActive: true,
    },
  });
  escalationContacts.push(dispatcherContact1);

  const dispatcherContact2 = await prisma.escalationContact.create({
    data: {
      userId: dispatcher.id,
      position: 'Regional Dispatcher',
      contactType: ContactType.sms,
      timeoutSeconds: 240, // 4 minutes
      isActive: true,
    },
  });
  escalationContacts.push(dispatcherContact2);

  console.log(`Created ${escalationContacts.length} escalation contacts`);

  // 7.1. Create escalations for high severity issues (aiSeverityScore >= 0.8)
  const highSeverityIssues = issues.filter(issue => issue.aiSeverityScore >= 0.8);
  const escalationLogs = [];
  
  for (const issue of highSeverityIssues) {
    // Get first escalation contact (lowest timeout = highest priority)
    const sortedContacts = [...escalationContacts].sort((a, b) => a.timeoutSeconds - b.timeoutSeconds);
    const firstContact = sortedContacts[0];
    
    if (firstContact) {
      const escalationLog = await prisma.escalationLog.create({
        data: {
          shipmentId: issue.shipmentId,
          deliveryIssueId: issue.id,
          contactId: firstContact.id,
          attemptNumber: 1,
          eventType: 'triggered',
          payload: {
            reason: `High severity issue (score: ${issue.aiSeverityScore})`,
            triggeredBy: 'system',
            issueType: issue.issueType,
            description: issue.description,
          },
          ackReceived: false,
        },
        include: {
          shipment: {
            select: {
              id: true,
              trackingNumber: true,
            },
          },
          contact: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          deliveryIssue: {
            select: {
              id: true,
              issueType: true,
              aiSeverityScore: true,
            },
          },
        },
      });
      escalationLogs.push(escalationLog);
    }
  }
  
  console.log(`Created ${escalationLogs.length} escalations for high severity issues`);

  // 8. Create dashboard config defaults for each role
  const dashboardConfigs = [];
  
  // Customer dashboard config
  const customerConfig = await prisma.dashboardConfig.create({
    data: {
      ownerType: 'role',
      ownerRole: Role.customer,
      layout: {
        widgets: [
          { id: 'shipment-list', type: 'shipment-list', position: { x: 0, y: 0, w: 6, h: 4 } },
          { id: 'chat-widget', type: 'chat-widget', position: { x: 6, y: 0, w: 6, h: 4 } },
          { id: 'shipment-detail', type: 'shipment-detail', position: { x: 0, y: 4, w: 12, h: 4 } },
        ],
      },
    },
  });
  dashboardConfigs.push(customerConfig);

  // Driver dashboard config
  const driverConfig = await prisma.dashboardConfig.create({
    data: {
      ownerType: 'role',
      ownerRole: Role.driver,
      layout: {
        widgets: [
          { id: 'route-view', type: 'route-view', position: { x: 0, y: 0, w: 12, h: 6 } },
          { id: 'route-stops', type: 'route-stops', position: { x: 0, y: 6, w: 12, h: 6 } },
        ],
      },
    },
  });
  dashboardConfigs.push(driverConfig);

  // Dispatcher dashboard config
  const dispatcherConfig = await prisma.dashboardConfig.create({
    data: {
      ownerType: 'role',
      ownerRole: Role.dispatcher,
      layout: {
        widgets: [
          { id: 'shipments-overview', type: 'shipments-overview', position: { x: 0, y: 0, w: 6, h: 3 } },
          { id: 'routes-overview', type: 'routes-overview', position: { x: 6, y: 0, w: 6, h: 3 } },
          { id: 'issues-queue', type: 'issues-queue', position: { x: 0, y: 3, w: 12, h: 6 } },
          { id: 'metrics-cards', type: 'metrics-cards', position: { x: 0, y: 9, w: 12, h: 3 } },
        ],
      },
    },
  });
  dashboardConfigs.push(dispatcherConfig);

  // Manager dashboard config
  const managerConfig = await prisma.dashboardConfig.create({
    data: {
      ownerType: 'role',
      ownerRole: Role.manager,
      layout: {
        widgets: [
          { id: 'metrics-overview', type: 'metrics-overview', position: { x: 0, y: 0, w: 12, h: 4 } },
          { id: 'escalations-view', type: 'escalations-view', position: { x: 0, y: 4, w: 6, h: 4 } },
          { id: 'issues-queue', type: 'issues-queue', position: { x: 6, y: 4, w: 6, h: 4 } },
          { id: 'shipments-table', type: 'shipments-table', position: { x: 0, y: 8, w: 12, h: 4 } },
        ],
      },
    },
  });
  dashboardConfigs.push(managerConfig);

  // Admin dashboard config
  const adminConfig = await prisma.dashboardConfig.create({
    data: {
      ownerType: 'role',
      ownerRole: Role.admin,
      layout: {
        widgets: [
          { id: 'metrics-overview', type: 'metrics-overview', position: { x: 0, y: 0, w: 12, h: 3 } },
          { id: 'shipments-overview', type: 'shipments-overview', position: { x: 0, y: 3, w: 4, h: 3 } },
          { id: 'routes-overview', type: 'routes-overview', position: { x: 4, y: 3, w: 4, h: 3 } },
          { id: 'issues-queue', type: 'issues-queue', position: { x: 8, y: 3, w: 4, h: 3 } },
          { id: 'escalations-view', type: 'escalations-view', position: { x: 0, y: 6, w: 6, h: 4 } },
          { id: 'metrics-admin', type: 'metrics-admin', position: { x: 6, y: 6, w: 6, h: 4 } },
        ],
      },
    },
  });
  dashboardConfigs.push(adminConfig);

  console.log(`Created ${dashboardConfigs.length} dashboard configs`);

  console.log('\nSeeding completed successfully!');
  console.log(`Summary:`);
  console.log(`- Users: ${[admin, manager, dispatcher, driver1, driver2, driver3, customer1, customer2, customer3, customer4, customer5].length}`);
  console.log(`- Vehicles: 3`);
  console.log(`- Drivers: 3`);
  console.log(`- Metric Definitions: 4`);
  console.log(`- Shipments: ${shipments.length}`);
  console.log(`- Routes: ${routes.length}`);
  console.log(`- Delivery Issues: ${issues.length}`);
  console.log(`- Escalation Contacts: ${escalationContacts.length}`);
  console.log(`- Escalations: ${escalationLogs.length}`);
  console.log(`- Dashboard Configs: ${dashboardConfigs.length}`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
