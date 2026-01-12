import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { AcknowledgmentsService } from './acknowledgments.service';
import { TriggerEscalationDto } from './dto/trigger-escalation.dto';
import { AdvanceEscalationDto } from './dto/advance-escalation.dto';
import { AcknowledgeEscalationDto } from './dto/acknowledge-escalation.dto';
import { CreateEscalationContactDto } from './dto/create-escalation-contact.dto';
import { Role } from '@prisma/client';

@Injectable()
export class EscalationsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private acknowledgmentsService: AcknowledgmentsService,
  ) {}

  /**
   * Check if escalation should be triggered automatically
   */
  async shouldTriggerEscalation(shipmentId: string, deliveryIssueId?: string): Promise<{
    shouldTrigger: boolean;
    reason: string;
  }> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        deliveryIssues: deliveryIssueId
          ? {
              where: { id: deliveryIssueId },
            }
          : true,
      },
    });

    if (!shipment) {
      return { shouldTrigger: false, reason: 'Shipment not found' };
    }

    // Check if already has active escalation
    const activeEscalation = await this.prisma.escalationLog.findFirst({
      where: {
        shipmentId,
        ackReceived: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (activeEscalation) {
      return { shouldTrigger: false, reason: 'Active escalation already exists' };
    }

    // Check high severity issues
    if (deliveryIssueId || shipment.deliveryIssues.length > 0) {
      const issues = deliveryIssueId
        ? shipment.deliveryIssues.filter((i) => i.id === deliveryIssueId)
        : shipment.deliveryIssues;

      const highSeverityIssue = issues.find((issue) => issue.aiSeverityScore > 0.8);
      if (highSeverityIssue) {
        return {
          shouldTrigger: true,
          reason: `High severity issue (score: ${highSeverityIssue.aiSeverityScore})`,
        };
      }
    }

    // Check VIP shipments with issues
    if (shipment.isVip && shipment.deliveryIssues.length > 0) {
      return { shouldTrigger: true, reason: 'VIP shipment with delivery issues' };
    }

    // Check SLA risk
    if (shipment.slaRiskScore > 0.7) {
      return {
        shouldTrigger: true,
        reason: `High SLA risk (score: ${shipment.slaRiskScore})`,
      };
    }

    return { shouldTrigger: false, reason: 'No escalation criteria met' };
  }

  /**
   * Trigger escalation - can be called manually or automatically
   */
  async triggerEscalation(triggerDto: TriggerEscalationDto, userId: string) {
    // Validate shipment exists
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: triggerDto.shipmentId },
      include: {
        deliveryIssues: triggerDto.deliveryIssueId
          ? {
              where: { id: triggerDto.deliveryIssueId },
            }
          : true,
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // Check if escalation already active
    const activeEscalation = await this.prisma.escalationLog.findFirst({
      where: {
        shipmentId: triggerDto.shipmentId,
        ackReceived: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (activeEscalation) {
      throw new BadRequestException('Active escalation already exists for this shipment');
    }

    // Get active escalation contacts ordered by position (ladder order)
    const contacts = await this.prisma.escalationContact.findMany({
      where: { isActive: true },
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
      orderBy: {
        timeoutSeconds: 'asc', // Shorter timeout = higher priority (contact first)
      },
    });

    if (contacts.length === 0) {
      throw new BadRequestException('No active escalation contacts configured');
    }

    // Create escalation log for first contact
    const firstContact = contacts[0];
    const escalationLog = await this.prisma.escalationLog.create({
      data: {
        shipmentId: triggerDto.shipmentId,
        deliveryIssueId: triggerDto.deliveryIssueId,
        contactId: firstContact.id,
        attemptNumber: 1,
        eventType: 'triggered',
        payload: {
          reason: triggerDto.reason || 'Manual escalation triggered',
          triggeredBy: userId,
          contact: {
            id: firstContact.id,
            userId: firstContact.userId,
            position: firstContact.position,
            contactType: firstContact.contactType,
            timeoutSeconds: firstContact.timeoutSeconds,
          },
        },
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

    // Emit WebSocket event
    this.eventsGateway.emitEscalationTriggered(escalationLog);

    return escalationLog;
  }

  /**
   * Advance escalation ladder to next contact
   */
  async advanceEscalation(
    shipmentId: string,
    advanceDto: AdvanceEscalationDto,
    userId: string,
  ) {
    // Get current active escalation
    const currentLog = await this.prisma.escalationLog.findFirst({
      where: {
        shipmentId,
        ackReceived: false,
      },
      include: {
        contact: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!currentLog) {
      throw new NotFoundException('No active escalation found for this shipment');
    }

    // Get all active contacts
    const allContacts = await this.prisma.escalationContact.findMany({
      where: { isActive: true },
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
      orderBy: {
        timeoutSeconds: 'asc',
      },
    });

    // Find current contact index
    const currentIndex = allContacts.findIndex((c) => c.id === currentLog.contactId);

    if (currentIndex === -1 || currentIndex >= allContacts.length - 1) {
      throw new BadRequestException('No more contacts in escalation ladder');
    }

    // Get next contact
    const nextContact = allContacts[currentIndex + 1];

    // Get all previous logs for this shipment to calculate attempt number
    const previousLogs = await this.prisma.escalationLog.findMany({
      where: { shipmentId },
    });
    const nextAttemptNumber = previousLogs.length + 1;

    // Create escalation log for next contact
    const escalationLog = await this.prisma.escalationLog.create({
      data: {
        shipmentId: currentLog.shipmentId,
        deliveryIssueId: currentLog.deliveryIssueId,
        contactId: nextContact.id,
        attemptNumber: nextAttemptNumber,
        eventType: 'advanced',
        payload: {
          reason: advanceDto.reason || 'Timeout or no response from previous contact',
          advancedBy: userId,
          previousContactId: currentLog.contactId,
          contact: {
            id: nextContact.id,
            userId: nextContact.userId,
            position: nextContact.position,
            contactType: nextContact.contactType,
            timeoutSeconds: nextContact.timeoutSeconds,
          },
        },
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

    // Emit WebSocket event
    this.eventsGateway.emitEscalationAdvanced(escalationLog);

    return escalationLog;
  }

  /**
   * Acknowledge escalation
   */
  async acknowledgeEscalation(
    shipmentId: string,
    acknowledgeDto: AcknowledgeEscalationDto,
    userId: string,
  ) {
    // Validate shipment exists
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    // Get current active escalation log (most recent unacknowledged)
    const currentLog = await this.prisma.escalationLog.findFirst({
      where: {
        shipmentId,
        ackReceived: false,
      },
      include: {
        contact: true,
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!currentLog) {
      throw new NotFoundException('No active escalation found for this shipment');
    }

    // Update escalation log
    const updatedLog = await this.prisma.escalationLog.update({
      where: { id: currentLog.id },
      data: {
        ackReceived: true,
        ackMethod: acknowledgeDto.method,
        acknowledgedAt: new Date(),
        payload: {
          ...((currentLog.payload as any) || {}),
          acknowledgedBy: userId,
          acknowledgedAt: new Date().toISOString(),
          notes: acknowledgeDto.notes,
        },
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

    // Create acknowledgment record
    try {
      await this.acknowledgmentsService.create({
        shipmentId,
        deliveryIssueId: currentLog.deliveryIssueId || undefined,
        userId,
        method: acknowledgeDto.method,
        notes: acknowledgeDto.notes,
      });
    } catch (error) {
      // If acknowledgment creation fails, log but don't fail the entire operation
      // since the escalation log is already updated
      console.error('Failed to create acknowledgment record:', error);
    }

    // Emit WebSocket event
    this.eventsGateway.emitEscalationAcknowledged(updatedLog);

    return updatedLog;
  }

  async findAll(
    filters: {
      shipmentId?: string;
      deliveryIssueId?: string;
      status?: 'active' | 'acknowledged' | 'resolved';
    },
    userId?: string,
    userRole?: Role,
  ) {
    const where: any = {};

    if (filters.shipmentId) {
      where.shipmentId = filters.shipmentId;
    }

    if (filters.deliveryIssueId) {
      where.deliveryIssueId = filters.deliveryIssueId;
    }

    if (filters.status) {
      switch (filters.status) {
        case 'active':
          where.ackReceived = false;
          break;
        case 'acknowledged':
          where.ackReceived = true;
          break;
        case 'resolved':
          // Resolved escalations would have all logs acknowledged
          // For now, we'll use acknowledged as resolved
          where.ackReceived = true;
          break;
      }
    }

    // RBAC: For dispatchers, filter by their assigned region
    if (userRole === Role.dispatcher && userId) {
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
        return []; // No routes in region = no escalations
      }

      const stopsInRegion = await this.prisma.routeStop.findMany({
        where: { routeId: { in: routeIds } },
        select: { shipmentId: true },
      });

      const shipmentIds = [...new Set(stopsInRegion.map((s) => s.shipmentId))];

      if (shipmentIds.length > 0) {
        // If there's already a shipmentId filter, intersect it
        if (where.shipmentId) {
          if (!shipmentIds.includes(where.shipmentId)) {
            return [];
          }
        } else {
          where.shipmentId = { in: shipmentIds };
        }
      } else {
        return [];
      }
    }

    // Get all escalation logs
    const allLogs = await this.prisma.escalationLog.findMany({
      where,
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            currentStatus: true,
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
            status: true,
          },
        },
      },
      orderBy: {
        attemptNumber: 'asc', // Order by attempt number for proper ladder display
      },
    });

    // Group logs by shipmentId to create Escalation objects
    const escalationMap = new Map<string, any>();
    
    allLogs.forEach((log) => {
      if (!escalationMap.has(log.shipmentId)) {
        // Create new Escalation object for this shipment
        escalationMap.set(log.shipmentId, {
          shipmentId: log.shipmentId,
          deliveryIssueId: log.deliveryIssueId || undefined,
          logs: [log],
          // Include shipment info from the first log
          shipment: log.shipment ? {
            id: log.shipment.id,
            trackingNumber: log.shipment.trackingNumber,
            currentStatus: log.shipment.currentStatus,
          } : undefined,
        });
      } else {
        // Add log to existing escalation
        const escalation = escalationMap.get(log.shipmentId);
        escalation.logs.push(log);
      }
    });

    // Determine currentStatus for each escalation
    const escalations = Array.from(escalationMap.values()).map((escalation) => {
      // Check if there are any unacknowledged logs
      const hasUnacknowledged = escalation.logs.some((log: any) => !log.ackReceived);
      const allAcknowledged = escalation.logs.every((log: any) => log.ackReceived);
      
      let currentStatus: 'active' | 'acknowledged' | 'resolved';
      if (hasUnacknowledged) {
        currentStatus = 'active';
      } else if (allAcknowledged && escalation.logs.length > 0) {
        // If all logs are acknowledged, consider it resolved
        currentStatus = 'resolved';
      } else {
        currentStatus = 'acknowledged';
      }

      return {
        ...escalation,
        currentStatus,
      };
    });

    // Apply status filter if provided
    if (filters.status) {
      return escalations.filter((e) => e.currentStatus === filters.status);
    }

    return escalations;
  }

  async findOne(shipmentId: string, userId?: string, userRole?: Role) {
    // RBAC: For dispatchers, check if shipment is in their assigned region
    if (userRole === Role.dispatcher && userId) {
      const dispatcherProfile = await this.prisma.dispatcherProfile.findUnique({
        where: { userId },
      });

      if (!dispatcherProfile) {
        throw new ForbiddenException('Dispatcher profile not found');
      }

      // Check if shipment is in a route matching the dispatcher's region
      const shipment = await this.prisma.shipment.findUnique({
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

      if (shipment && shipment.routeStops.length > 0) {
        const shipmentRegions = shipment.routeStops.map(stop => stop.route.region);
        const isInAssignedRegion = shipmentRegions.includes(dispatcherProfile.assignedRegion);

        if (!isInAssignedRegion) {
          throw new ForbiddenException('You can only view escalations for shipments in your assigned region');
        }
      }
    }

    // Get all escalation logs for this shipment
    const logs = await this.prisma.escalationLog.findMany({
      where: { shipmentId },
      include: {
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
        shipment: {
          include: {
            deliveryIssues: true,
          },
        },
        deliveryIssue: {
          select: {
            id: true,
            issueType: true,
            aiSeverityScore: true,
            status: true,
          },
        },
      },
      orderBy: {
        attemptNumber: 'asc',
      },
    });

    if (logs.length === 0) {
      throw new NotFoundException('No escalation logs found for this shipment');
    }

    // Get acknowledgments for this shipment
    const acknowledgments = await this.acknowledgmentsService.findByShipment(shipmentId);

    return {
      shipmentId,
      logs,
      acknowledgments,
      isActive: logs.some((log) => !log.ackReceived),
      currentContact: logs.find((log) => !log.ackReceived)?.contact || null,
    };
  }

  async createEscalationContact(createDto: CreateEscalationContactDto) {
    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createDto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.escalationContact.create({
      data: {
        userId: createDto.userId,
        position: createDto.position,
        contactType: createDto.contactType,
        timeoutSeconds: createDto.timeoutSeconds,
        isActive: createDto.isActive !== undefined ? createDto.isActive : true,
      },
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
    });
  }

  async findAllEscalationContacts() {
    return this.prisma.escalationContact.findMany({
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
      orderBy: {
        timeoutSeconds: 'asc', // Order by ladder position
      },
    });
  }
}
