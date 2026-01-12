import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { FilterIssuesDto } from './dto/filter-issues.dto';
import { Role, IssueType, IssueStatus } from '@prisma/client';

@Injectable()
export class IssuesService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  /**
   * Calculate AI severity score based on issue type, description, and shipment context
   * Returns a score between 0.0 and 1.0
   */
  private calculateSeverityScore(
    issueType: IssueType,
    description: string,
    shipment: any,
  ): number {
    let baseScore = 0.5; // Default medium score

    // Base score by issue type
    switch (issueType) {
      case IssueType.damaged:
      case IssueType.missing:
        baseScore = 0.8; // High severity
        break;
      case IssueType.wrong_address:
      case IssueType.missed_delivery:
        baseScore = 0.6; // Medium-high severity
        break;
      case IssueType.delay:
        baseScore = 0.4; // Medium-low severity
        break;
      case IssueType.other:
        baseScore = 0.5; // Medium severity
        break;
    }

    // Adjust based on description keywords
    const lowerDescription = description.toLowerCase();
    const criticalKeywords = [
      'urgent',
      'critical',
      'emergency',
      'lost',
      'stolen',
      'destroyed',
      'completely',
    ];
    const highKeywords = [
      'important',
      'time sensitive',
      'damaged',
      'broken',
      'missing items',
    ];
    const lowKeywords = ['minor', 'slight', 'small', 'little'];

    if (criticalKeywords.some((keyword) => lowerDescription.includes(keyword))) {
      baseScore = Math.min(1.0, baseScore + 0.15);
    } else if (highKeywords.some((keyword) => lowerDescription.includes(keyword))) {
      baseScore = Math.min(1.0, baseScore + 0.1);
    } else if (lowKeywords.some((keyword) => lowerDescription.includes(keyword))) {
      baseScore = Math.max(0.2, baseScore - 0.1);
    }

    // Adjust based on shipment context
    if (shipment.isVip) {
      baseScore = Math.min(1.0, baseScore + 0.1); // VIP shipments get higher priority
    }

    if (shipment.slaRiskScore && shipment.slaRiskScore > 0.7) {
      baseScore = Math.min(1.0, baseScore + 0.05); // High SLA risk increases severity
    }

    return Math.round(baseScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get shipment region by looking up via RouteStop -> Route
   */
  private async getShipmentRegion(shipmentId: string): Promise<string | null> {
    const routeStop = await this.prisma.routeStop.findFirst({
      where: { shipmentId },
      include: {
        route: {
          select: {
            region: true,
          },
        },
      },
    });

    return routeStop?.route?.region || null;
  }

  async create(createIssueDto: CreateIssueDto, userId: string, userRole: Role) {
    // Validate shipment exists
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: createIssueDto.shipmentId },
      include: {
        routeStops: {
          include: {
            route: true,
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // RBAC: Customers can only create issues for their own shipments
    if (userRole === Role.customer && shipment.customerId !== userId) {
      throw new ForbiddenException('You can only create issues for your own shipments');
    }

    // Calculate AI severity score
    const aiSeverityScore = this.calculateSeverityScore(
      createIssueDto.issueType,
      createIssueDto.description,
      shipment,
    );

    // Create the issue
    const issue = await this.prisma.deliveryIssue.create({
      data: {
        shipmentId: createIssueDto.shipmentId,
        reportedByUserId: userId,
        issueType: createIssueDto.issueType,
        description: createIssueDto.description,
        aiSeverityScore,
        status: IssueStatus.open,
      },
      include: {
        shipment: {
          include: {
            customer: true,
          },
        },
        reportedByUser: true,
      },
    });

    // Emit WebSocket event
    this.eventsGateway.emitIssueCreated(issue);

    return issue;
  }

  async findAll(filters: FilterIssuesDto, userId: string, userRole: Role) {
    // Only dispatcher, manager, admin can list all issues
    const where: any = {};

    // Apply severity filter (based on aiSeverityScore ranges)
    if (filters.severity && filters.severity !== 'all') {
      switch (filters.severity) {
        case 'critical':
          where.aiSeverityScore = { gte: 0.8 };
          break;
        case 'high':
          where.aiSeverityScore = { gte: 0.6, lt: 0.8 };
          break;
        case 'medium':
          where.aiSeverityScore = { gte: 0.4, lt: 0.6 };
          break;
        case 'low':
          where.aiSeverityScore = { lt: 0.4 };
          break;
      }
    }

    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      where.status = filters.status as IssueStatus;
    }

    // Apply issue type filter
    if (filters.issueType) {
      where.issueType = filters.issueType;
    }

    // Apply shipment filter
    if (filters.shipmentId) {
      where.shipmentId = filters.shipmentId;
    }

    // RBAC: For dispatchers, filter by their assigned region
    if (userRole === Role.dispatcher) {
      const dispatcherProfile = await this.prisma.dispatcherProfile.findUnique({
        where: { userId },
      });

      if (!dispatcherProfile) {
        return []; // No profile = no access
      }

      // Get all shipments in dispatcher's assigned region via routes
      const routesInRegion = await this.prisma.route.findMany({
        where: { region: dispatcherProfile.assignedRegion },
        select: { id: true },
      });

      const routeIds = routesInRegion.map((r) => r.id);

      if (routeIds.length === 0) {
        return []; // No routes in region = no issues
      }

      const stopsInRegion = await this.prisma.routeStop.findMany({
        where: { routeId: { in: routeIds } },
        select: { shipmentId: true },
      });

      const shipmentIds = [...new Set(stopsInRegion.map((s) => s.shipmentId))];

      if (shipmentIds.length > 0) {
        // If there's already a shipmentId filter, intersect it
        if (where.shipmentId) {
          if (typeof where.shipmentId === 'string') {
            // Single shipment ID - check if it's in the region
            if (!shipmentIds.includes(where.shipmentId)) {
              return [];
            }
          } else if (where.shipmentId.in) {
            // Array of shipment IDs - intersect
            const filteredIds = where.shipmentId.in.filter((id: string) => shipmentIds.includes(id));
            if (filteredIds.length === 0) {
              return [];
            }
            where.shipmentId = { in: filteredIds };
          }
        } else {
          where.shipmentId = { in: shipmentIds };
        }
      } else {
        // No shipments in this region, return empty
        return [];
      }
    } else if (filters.region) {
      // Apply region filter for non-dispatcher roles (if explicitly provided)
      const routesInRegion = await this.prisma.route.findMany({
        where: { region: filters.region },
        select: { id: true },
      });

      const routeIds = routesInRegion.map((r) => r.id);

      const stopsInRegion = await this.prisma.routeStop.findMany({
        where: { routeId: { in: routeIds } },
        select: { shipmentId: true },
      });

      const shipmentIds = [...new Set(stopsInRegion.map((s) => s.shipmentId))];

      if (shipmentIds.length > 0) {
        where.shipmentId = { in: shipmentIds };
      } else {
        return [];
      }
    }

    return this.prisma.deliveryIssue.findMany({
      where,
      include: {
        shipment: {
          include: {
            customer: true,
            routeStops: {
              include: {
                route: {
                  select: {
                    region: true,
                  },
                },
              },
            },
          },
        },
        reportedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: [
        { aiSeverityScore: 'desc' }, // Highest severity first
        { createdAt: 'desc' }, // Most recent first
      ],
    });
  }

  async findOne(id: string, userId: string, userRole: Role) {
    const issue = await this.prisma.deliveryIssue.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            customer: true,
            scans: {
              orderBy: {
                timestamp: 'desc',
              },
            },
            routeStops: {
              include: {
                route: {
                  select: {
                    id: true,
                    region: true,
                    driverId: true,
                  },
                },
              },
            },
          },
        },
        reportedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        escalationLogs: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        acknowledgments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    // RBAC: Customers can only view issues for their own shipments
    if (userRole === Role.customer && issue.shipment.customerId !== userId) {
      throw new ForbiddenException('You can only view issues for your own shipments');
    }

    // RBAC: Dispatchers can only view issues for shipments in their assigned region
    if (userRole === Role.dispatcher) {
      const dispatcherProfile = await this.prisma.dispatcherProfile.findUnique({
        where: { userId },
      });

      if (!dispatcherProfile) {
        throw new ForbiddenException('Dispatcher profile not found');
      }

      // Check if issue's shipment is in a route matching the dispatcher's region
      const shipmentRegions = issue.shipment.routeStops.map(stop => stop.route.region);
      const isInAssignedRegion = shipmentRegions.includes(dispatcherProfile.assignedRegion);

      if (!isInAssignedRegion && issue.shipment.routeStops.length > 0) {
        throw new ForbiddenException('You can only view issues for shipments in your assigned region');
      }
    }

    // RBAC: Drivers can only view issues for shipments in their assigned routes
    if (userRole === Role.driver && userId) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId },
      });

      if (!driver) {
        throw new ForbiddenException('Driver profile not found');
      }

      // Check if issue's shipment is in a route assigned to this driver
      const shipmentRouteIds = issue.shipment.routeStops.map(stop => stop.route.id);
      
      if (shipmentRouteIds.length === 0) {
        // Pending shipments without routes - drivers can't see issues for them yet
        throw new ForbiddenException('You can only view issues for shipments in your assigned routes');
      }

      // Get all routes assigned to this driver
      const driverRoutes = await this.prisma.route.findMany({
        where: { driverId: driver.id },
        select: { id: true },
      });

      const driverRouteIds = driverRoutes.map(r => r.id);
      const isInAssignedRoute = shipmentRouteIds.some(routeId => driverRouteIds.includes(routeId));

      if (!isInAssignedRoute) {
        throw new ForbiddenException('You can only view issues for shipments in your assigned routes');
      }
    }

    return issue;
  }

  async update(id: string, updateIssueDto: UpdateIssueDto, userId: string, userRole: Role) {
    const issue = await this.prisma.deliveryIssue.findUnique({
      where: { id },
      include: {
        shipment: true,
      },
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    // Only dispatcher, manager, admin can update issues
    // This is already enforced at the controller level via RBAC

    const updateData: any = {};
    if (updateIssueDto.status !== undefined) {
      updateData.status = updateIssueDto.status;
    }
    if (updateIssueDto.resolutionNotes !== undefined) {
      updateData.resolutionNotes = updateIssueDto.resolutionNotes;
    }

    const updatedIssue = await this.prisma.deliveryIssue.update({
      where: { id },
      data: updateData,
      include: {
        shipment: {
          include: {
            customer: true,
          },
        },
        reportedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Emit WebSocket event
    this.eventsGateway.emitIssueUpdate(updatedIssue);

    return updatedIssue;
  }

  async findByShipment(shipmentId: string, userId: string, userRole: Role) {
    // Validate shipment exists
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // RBAC: Customers can only view issues for their own shipments
    if (userRole === Role.customer && shipment.customerId !== userId) {
      throw new ForbiddenException('You can only view issues for your own shipments');
    }

    return this.prisma.deliveryIssue.findMany({
      where: { shipmentId },
      include: {
        reportedByUser: {
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
}
