import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { AgentChannel, AgentSessionStatus, Role } from '@prisma/client';

@Injectable()
export class AgentSessionsService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateSessionDto, userId: string | null, userRole: Role | null) {
    // Validate shipment exists if provided
    if (createDto.linkedShipmentId) {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: createDto.linkedShipmentId },
      });
      if (!shipment) {
        throw new NotFoundException('Shipment not found');
      }
    }

    // Determine role (use user role or default to customer_guest for anonymous)
    const role = userRole ? userRole : 'customer_guest';

    return this.prisma.agentSession.create({
      data: {
        userId: userId || null,
        role: role as string,
        channel: createDto.channel,
        linkedShipmentId: createDto.linkedShipmentId,
        openAiSessionId: createDto.openAiSessionId,
        status: AgentSessionStatus.active,
        startedAt: new Date(),
        transcript: [],
        outcome: undefined,
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
        linkedShipment: {
          select: {
            id: true,
            trackingNumber: true,
            currentStatus: true,
          },
        },
      },
    });
  }

  async findOne(id: string, userId: string | null, userRole: Role | null) {
    const session = await this.prisma.agentSession.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        linkedShipment: {
          include: {
            scans: {
              orderBy: {
                timestamp: 'desc',
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Agent session not found');
    }

    // RBAC: Users can only view their own sessions (unless admin/manager)
    if (userRole !== Role.admin && userRole !== Role.manager) {
      if (!userId || session.userId !== userId) {
        throw new NotFoundException('Agent session not found');
      }
    }

    return session;
  }

  async update(id: string, updateDto: UpdateSessionDto, userId: string | null, userRole: Role | null) {
    const session = await this.prisma.agentSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('Agent session not found');
    }

    // RBAC: Users can only update their own sessions (unless admin/manager)
    if (userRole !== Role.admin && userRole !== Role.manager) {
      if (!userId || session.userId !== userId) {
        throw new NotFoundException('Agent session not found');
      }
    }

    // Validate shipment exists if provided
    if (updateDto.linkedShipmentId) {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: updateDto.linkedShipmentId },
      });
      if (!shipment) {
        throw new NotFoundException('Shipment not found');
      }
    }

    const updateData: any = {};
    if (updateDto.linkedShipmentId !== undefined) {
      updateData.linkedShipmentId = updateDto.linkedShipmentId;
    }
    if (updateDto.openAiSessionId !== undefined) {
      updateData.openAiSessionId = updateDto.openAiSessionId;
    }
    if (updateDto.lastAgentName !== undefined) {
      updateData.lastAgentName = updateDto.lastAgentName;
    }
    if (updateDto.transcript !== undefined) {
      // Merge with existing transcript if it's an array append operation
      // For now, we'll replace it (can be enhanced to append)
      updateData.transcript = updateDto.transcript;
    }
    if (updateDto.outcome !== undefined) {
      // Merge with existing outcome
      const existingOutcome = session.outcome as any || {};
      updateData.outcome = { ...existingOutcome, ...updateDto.outcome };
    }

    return this.prisma.agentSession.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        linkedShipment: {
          select: {
            id: true,
            trackingNumber: true,
            currentStatus: true,
          },
        },
      },
    });
  }

  async endSession(id: string, userId: string | null, userRole: Role | null) {
    const session = await this.prisma.agentSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('Agent session not found');
    }

    // RBAC: Users can only end their own sessions (unless admin/manager)
    if (userRole !== Role.admin && userRole !== Role.manager) {
      if (!userId || session.userId !== userId) {
        throw new NotFoundException('Agent session not found');
      }
    }

    if (session.status === AgentSessionStatus.completed) {
      throw new BadRequestException('Session is already completed');
    }

    return this.prisma.agentSession.update({
      where: { id },
      data: {
        status: AgentSessionStatus.completed,
        endedAt: new Date(),
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
        linkedShipment: {
          select: {
            id: true,
            trackingNumber: true,
            currentStatus: true,
          },
        },
      },
    });
  }

  async findAll(
    filters: {
      userId?: string;
      channel?: AgentChannel;
      status?: AgentSessionStatus;
    },
    currentUserId: string | null,
    userRole: Role | null,
  ) {
    const where: any = {};

    // RBAC: Non-admin/manager users can only see their own sessions
    if (userRole !== Role.admin && userRole !== Role.manager) {
      if (!currentUserId) {
        return []; // Anonymous users can't list sessions
      }
      where.userId = currentUserId;
    } else if (filters.userId) {
      // Admin/manager can filter by any userId
      where.userId = filters.userId;
    }

    if (filters.channel) {
      where.channel = filters.channel;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return this.prisma.agentSession.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        linkedShipment: {
          select: {
            id: true,
            trackingNumber: true,
            currentStatus: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
    });
  }

  /**
   * Append message to transcript
   */
  async appendToTranscript(
    sessionId: string,
    message: { role: 'user' | 'assistant'; content: string; timestamp?: Date },
    userId: string | null,
    userRole: Role | null,
  ) {
    const session = await this.prisma.agentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Agent session not found');
    }

    // RBAC: Users can only update their own sessions (unless admin/manager)
    if (userRole !== Role.admin && userRole !== Role.manager) {
      if (!userId || session.userId !== userId) {
        throw new NotFoundException('Agent session not found');
      }
    }

    const transcript = (session.transcript as any) || [];
    const newMessage = {
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || new Date(),
    };

    transcript.push(newMessage);

    return this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        transcript,
      },
      include: {
        user: {
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
   * Update outcome (e.g., when an action is taken)
   */
  async updateOutcome(
    sessionId: string,
    outcomeData: {
      action?: string; // e.g., 'issueCreated', 'changeRequested', 'escalationTriggered'
      data?: any; // Additional outcome data
    },
    userId: string | null,
    userRole: Role | null,
  ) {
    const session = await this.prisma.agentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Agent session not found');
    }

    // RBAC: Users can only update their own sessions (unless admin/manager)
    if (userRole !== Role.admin && userRole !== Role.manager) {
      if (!userId || session.userId !== userId) {
        throw new NotFoundException('Agent session not found');
      }
    }

    const existingOutcome = (session.outcome as any) || {};
    const updatedOutcome = {
      ...existingOutcome,
      ...outcomeData,
      updatedAt: new Date().toISOString(),
    };

    return this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        outcome: updatedOutcome,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }
}
