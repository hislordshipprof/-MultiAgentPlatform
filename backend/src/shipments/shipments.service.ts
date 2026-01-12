import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ShipmentStatus, ScanType, ServiceLevel, Role } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';
import { CreateScanDto } from './dto/create-scan.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class ShipmentsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(data: Prisma.ShipmentCreateInput) {
    return this.prisma.shipment.create({ data });
  }

  async findAll(userId?: string, userRole?: Role) {
    // RBAC: Customers can only see their own shipments
    if (userRole === Role.customer && userId) {
      return this.prisma.shipment.findMany({
        where: { customerId: userId },
        include: { 
          scans: {
            orderBy: {
              timestamp: 'desc',
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    // RBAC: Dispatchers can only see shipments in their assigned region
    if (userRole === Role.dispatcher && userId) {
      const dispatcherProfile = await this.prisma.dispatcherProfile.findUnique({
        where: { userId },
      });

      if (!dispatcherProfile) {
        return []; // No profile = no access
      }

      // Get shipments that are in routes matching the dispatcher's region
      const routesInRegion = await this.prisma.route.findMany({
        where: { region: dispatcherProfile.assignedRegion },
        select: { id: true },
      });

      const routeIds = routesInRegion.map(r => r.id);

      if (routeIds.length === 0) {
        return []; // No routes in region = no shipments
      }

      // Get shipments that have route stops in these routes
      const shipmentsInRegion = await this.prisma.shipment.findMany({
        where: {
          routeStops: {
            some: {
              routeId: { in: routeIds },
            },
          },
        },
        include: { 
          scans: {
            orderBy: {
              timestamp: 'desc',
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return shipmentsInRegion;
    }

    // RBAC: Drivers can only see shipments in their assigned routes
    if (userRole === Role.driver && userId) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId },
      });

      if (!driver) {
        return []; // No driver profile = no access
      }

      // Get all routes assigned to this driver
      const driverRoutes = await this.prisma.route.findMany({
        where: { driverId: driver.id },
        select: { id: true },
      });

      const routeIds = driverRoutes.map(r => r.id);

      if (routeIds.length === 0) {
        return []; // No routes assigned = no shipments
      }

      // Get shipments that have route stops in these routes
      const shipmentsInRoutes = await this.prisma.shipment.findMany({
        where: {
          routeStops: {
            some: {
              routeId: { in: routeIds },
            },
          },
        },
        include: { 
          scans: {
            orderBy: {
              timestamp: 'desc',
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return shipmentsInRoutes;
    }
    
    // Admin, Manager, Dispatcher: See all shipments (dispatcher filtered by region above)
    return this.prisma.shipment.findMany({
      include: { 
        scans: {
          orderBy: {
            timestamp: 'desc',
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId?: string, userRole?: Role) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: { 
        scans: {
          orderBy: {
            timestamp: 'desc',
          },
        },
        deliveryIssues: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        routeStops: {
          include: {
            route: {
              select: {
                id: true,
                region: true,
              },
            },
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // RBAC: Customers can only view their own shipments
    if (userRole === Role.customer && userId && shipment.customerId !== userId) {
      throw new ForbiddenException('You can only view your own shipments');
    }

    // RBAC: Dispatchers can only view shipments in their assigned region
    if (userRole === Role.dispatcher && userId) {
      const dispatcherProfile = await this.prisma.dispatcherProfile.findUnique({
        where: { userId },
      });

      if (!dispatcherProfile) {
        throw new ForbiddenException('Dispatcher profile not found');
      }

      // Check if shipment is in a route matching the dispatcher's region
      const shipmentRegions = shipment.routeStops.map(stop => stop.route.region);
      const isInAssignedRegion = shipmentRegions.includes(dispatcherProfile.assignedRegion);

      // Also check if shipment has no route stops yet (pending shipments might not have routes)
      if (shipment.routeStops.length === 0) {
        // For pending shipments without routes, allow dispatcher to see them
        // (They can be assigned to their region later)
      } else if (!isInAssignedRegion) {
        throw new ForbiddenException('You can only view shipments in your assigned region');
      }
    }

    // RBAC: Drivers can only view shipments in their assigned routes
    if (userRole === Role.driver && userId) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId },
      });

      if (!driver) {
        throw new ForbiddenException('Driver profile not found');
      }

      // Check if shipment is in a route assigned to this driver
      const shipmentRouteIds = shipment.routeStops.map(stop => stop.route.id);
      
      if (shipmentRouteIds.length === 0) {
        // Pending shipments without routes - drivers can't see them yet
        throw new ForbiddenException('You can only view shipments in your assigned routes');
      }

      // Get all routes assigned to this driver
      const driverRoutes = await this.prisma.route.findMany({
        where: { driverId: driver.id },
        select: { id: true },
      });

      const driverRouteIds = driverRoutes.map(r => r.id);
      const isInAssignedRoute = shipmentRouteIds.some(routeId => driverRouteIds.includes(routeId));

      if (!isInAssignedRoute) {
        throw new ForbiddenException('You can only view shipments in your assigned routes');
      }
    }

    return shipment;
  }

  async findByTracking(trackingNumber: string) {
    return this.prisma.shipment.findUnique({
      where: { trackingNumber },
      include: {
        scans: {
          orderBy: {
            timestamp: 'desc',
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Calculate SLA risk score (0-1)
   * Factors:
   * - Time until promisedDeliveryDate
   * - serviceLevel (priority = higher risk if late)
   * - isVip (VIP = higher risk)
   * - currentStatus (delivered = 0, pending = lower risk, in_transit = higher risk if close to deadline)
   */
  private calculateSlaRiskScore(
    shipment: {
      promisedDeliveryDate: Date | null;
      serviceLevel: ServiceLevel;
      isVip: boolean;
      currentStatus: ShipmentStatus;
      lastScanAt: Date | null;
    },
  ): number {
    // If delivered, no risk
    if (shipment.currentStatus === ShipmentStatus.delivered) {
      return 0.0;
    }

    // If no promised delivery date, calculate based on status and age
    if (!shipment.promisedDeliveryDate) {
      let baseRisk = 0.1; // Minimal risk
      if (shipment.currentStatus === ShipmentStatus.in_transit) {
        baseRisk = 0.2;
      }
      if (shipment.isVip) {
        baseRisk += 0.1;
      }
      if (shipment.serviceLevel === ServiceLevel.same_day) {
        baseRisk += 0.1;
      }
      return Math.min(baseRisk, 1.0);
    }

    const now = new Date();
    const promisedDate = new Date(shipment.promisedDeliveryDate);
    const timeUntilDelivery = promisedDate.getTime() - now.getTime();
    const hoursUntilDelivery = timeUntilDelivery / (1000 * 60 * 60);

    // Base risk calculation based on time remaining
    let riskScore = 0.0;

    // If already past promised date, high risk
    if (timeUntilDelivery < 0) {
      const hoursOverdue = Math.abs(hoursUntilDelivery);
      if (hoursOverdue < 24) {
        riskScore = 0.7;
      } else if (hoursOverdue < 48) {
        riskScore = 0.85;
      } else {
        riskScore = 0.95;
      }
    } else {
      // Risk increases as we approach the deadline
      if (hoursUntilDelivery < 12) {
        riskScore = 0.6;
      } else if (hoursUntilDelivery < 24) {
        riskScore = 0.4;
      } else if (hoursUntilDelivery < 48) {
        riskScore = 0.25;
      } else {
        riskScore = 0.1;
      }
    }

    // Adjust based on status
    if (shipment.currentStatus === ShipmentStatus.in_transit) {
      // If in transit and close to deadline, increase risk
      if (hoursUntilDelivery < 24) {
        riskScore += 0.15;
      }
    } else if (shipment.currentStatus === ShipmentStatus.PENDING) {
      // If still pending and close to deadline, higher risk
      if (hoursUntilDelivery < 24) {
        riskScore += 0.2;
      }
    }

    // Adjust for service level
    if (shipment.serviceLevel === ServiceLevel.same_day) {
      riskScore += 0.15;
    } else if (shipment.serviceLevel === ServiceLevel.express) {
      riskScore += 0.1;
    }

    // Adjust for VIP
    if (shipment.isVip) {
      riskScore += 0.2;
    }

    // Cap at 1.0
    return Math.min(riskScore, 1.0);
  }

  /**
   * Create a scan for a shipment
   * Auto-updates lastScanAt and lastScanLocation
   * Updates SLA risk score
   * Emits WebSocket event
   */
  async createScan(shipmentId: string, createScanDto: CreateScanDto) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // Create the scan
    const scan = await this.prisma.shipmentScan.create({
      data: {
        shipmentId,
        scanType: createScanDto.scanType,
        location: createScanDto.location,
        notes: createScanDto.notes,
        timestamp: new Date(),
      },
    });

    // Update shipment's lastScanAt and lastScanLocation
    const updatedShipment = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        lastScanAt: scan.timestamp,
        lastScanLocation: createScanDto.location,
        // Recalculate SLA risk score
        slaRiskScore: this.calculateSlaRiskScore({
          promisedDeliveryDate: shipment.promisedDeliveryDate,
          serviceLevel: shipment.serviceLevel,
          isVip: shipment.isVip,
          currentStatus: shipment.currentStatus,
          lastScanAt: scan.timestamp,
        }),
      },
      include: {
        scans: {
          orderBy: {
            timestamp: 'desc',
          },
        },
      },
    });

    // Emit WebSocket event
    this.eventsGateway.emitShipmentUpdate(shipment.trackingNumber, {
      type: 'scan.created',
      scan,
      shipment: updatedShipment,
    });

    return {
      scan,
      shipment: updatedShipment,
    };
  }

  /**
   * Update shipment status
   * Updates SLA risk score
   * Emits WebSocket event
   */
  async updateStatus(shipmentId: string, updateStatusDto: UpdateStatusDto) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // If status is being set to delivered, create a delivered scan if one doesn't exist
    if (
      updateStatusDto.status === ShipmentStatus.delivered &&
      shipment.currentStatus !== ShipmentStatus.delivered
    ) {
      const hasDeliveredScan = await this.prisma.shipmentScan.findFirst({
        where: {
          shipmentId,
          scanType: ScanType.delivered,
        },
      });

      if (!hasDeliveredScan) {
        await this.prisma.shipmentScan.create({
          data: {
            shipmentId,
            scanType: ScanType.delivered,
            location: shipment.lastScanLocation || 'Delivery location',
            timestamp: new Date(),
            notes: 'Status updated to delivered',
          },
        });
      }
    }

    // Update status and recalculate SLA risk score
    const updatedShipment = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        currentStatus: updateStatusDto.status,
        slaRiskScore: this.calculateSlaRiskScore({
          promisedDeliveryDate: shipment.promisedDeliveryDate,
          serviceLevel: shipment.serviceLevel,
          isVip: shipment.isVip,
          currentStatus: updateStatusDto.status,
          lastScanAt: shipment.lastScanAt,
        }),
      },
      include: {
        scans: {
          orderBy: {
            timestamp: 'desc',
          },
        },
      },
    });

    // Emit WebSocket event
    this.eventsGateway.emitShipmentUpdate(shipment.trackingNumber, {
      type: 'status.updated',
      previousStatus: shipment.currentStatus,
      newStatus: updateStatusDto.status,
      shipment: updatedShipment,
    });

    return updatedShipment;
  }

  /**
   * Get shipment timeline (scans + status changes)
   * Returns chronological timeline of all events
   */
  async getTimeline(shipmentId: string, userId?: string, userRole?: Role) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        scans: {
          orderBy: {
            timestamp: 'asc',
          },
        },
        deliveryIssues: {
          select: {
            id: true,
            issueType: true,
            description: true,
            status: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // RBAC: Customers can only view timeline for their own shipments
    if (userRole === Role.customer && userId && shipment.customerId !== userId) {
      throw new ForbiddenException('You can only view timeline for your own shipments');
    }

    // RBAC: Dispatchers can only view timeline for shipments in their assigned region
    if (userRole === Role.dispatcher && userId) {
      const dispatcherProfile = await this.prisma.dispatcherProfile.findUnique({
        where: { userId },
      });

      if (!dispatcherProfile) {
        throw new ForbiddenException('Dispatcher profile not found');
      }

      // Get shipment with route stops to check region
      const shipmentWithRoutes = await this.prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: {
          routeStops: {
            include: {
              route: {
                select: {
                  id: true,
                  region: true,
                },
              },
            },
          },
        },
      });

      if (shipmentWithRoutes && shipmentWithRoutes.routeStops.length > 0) {
        const shipmentRegions = shipmentWithRoutes.routeStops.map(stop => stop.route.region);
        const isInAssignedRegion = shipmentRegions.includes(dispatcherProfile.assignedRegion);

        if (!isInAssignedRegion) {
          throw new ForbiddenException('You can only view timeline for shipments in your assigned region');
        }
      }
    }

    // RBAC: Drivers can only view timeline for shipments in their assigned routes
    if (userRole === Role.driver && userId) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId },
      });

      if (!driver) {
        throw new ForbiddenException('Driver profile not found');
      }

      // Get shipment with route stops to check driver assignment
      const shipmentWithRoutes = await this.prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: {
          routeStops: {
            include: {
              route: {
                select: {
                  id: true,
                  driverId: true,
                },
              },
            },
          },
        },
      });

      if (shipmentWithRoutes && shipmentWithRoutes.routeStops.length > 0) {
        const shipmentDriverIds = shipmentWithRoutes.routeStops
          .map(stop => stop.route.driverId)
          .filter(id => id !== null);

        // Check if any of the shipment's routes are assigned to this driver
        const isInAssignedRoute = shipmentDriverIds.includes(driver.id);

        if (!isInAssignedRoute) {
          throw new ForbiddenException('You can only view timeline for shipments in your assigned routes');
        }
      } else if (shipmentWithRoutes && shipmentWithRoutes.routeStops.length === 0) {
        // Pending shipments without routes - drivers can't see them yet
        throw new ForbiddenException('You can only view timeline for shipments in your assigned routes');
      }
    }

    // Build timeline from scans and issues
    const timeline: Array<{
      type: 'scan' | 'status' | 'issue' | 'creation';
      timestamp: Date;
      data: any;
    }> = [];

    // Add creation event
    timeline.push({
      type: 'creation',
      timestamp: shipment.createdAt,
      data: {
        status: ShipmentStatus.PENDING,
        trackingNumber: shipment.trackingNumber,
      },
    });

    // Add scans
    shipment.scans.forEach((scan) => {
      timeline.push({
        type: 'scan',
        timestamp: scan.timestamp,
        data: {
          scanType: scan.scanType,
          location: scan.location,
          notes: scan.notes,
          scanId: scan.id,
        },
      });
    });

    // Add issues
    shipment.deliveryIssues.forEach((issue) => {
      timeline.push({
        type: 'issue',
        timestamp: issue.createdAt,
        data: {
          issueType: issue.issueType,
          description: issue.description,
          status: issue.status,
          issueId: issue.id,
        },
      });
    });

    // Sort timeline chronologically
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Add status change events based on scans
    const statusMap: Record<ScanType, ShipmentStatus> = {
      [ScanType.pickup]: ShipmentStatus.PENDING,
      [ScanType.depot_checkin]: ShipmentStatus.in_transit,
      [ScanType.depot_checkout]: ShipmentStatus.in_transit,
      [ScanType.out_for_delivery]: ShipmentStatus.in_transit,
      [ScanType.delivered]: ShipmentStatus.delivered,
      [ScanType.failed_attempt]: ShipmentStatus.in_transit,
    };

    let currentStatus: ShipmentStatus = ShipmentStatus.PENDING;
    timeline.forEach((event) => {
      if (event.type === 'scan' && event.data.scanType in statusMap) {
        const newStatus = statusMap[event.data.scanType as ScanType];
        if (newStatus && newStatus !== currentStatus) {
          // Insert status change event
          event.data.previousStatus = currentStatus;
          event.data.newStatus = newStatus;
          currentStatus = newStatus;
        }
      }
    });

    // Add current status if it's different from the last event
    if (shipment.currentStatus !== currentStatus) {
      timeline.push({
        type: 'status',
        timestamp: shipment.updatedAt,
        data: {
          status: shipment.currentStatus,
          previousStatus: currentStatus,
        },
      });
    }

    return {
      shipment: {
        id: shipment.id,
        trackingNumber: shipment.trackingNumber,
        currentStatus: shipment.currentStatus,
        slaRiskScore: shipment.slaRiskScore,
      },
      timeline,
    };
  }
}
