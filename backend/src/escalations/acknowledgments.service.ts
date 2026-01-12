import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AcknowledgmentsService {
  constructor(private prisma: PrismaService) {}

  async create(acknowledgmentData: {
    shipmentId: string;
    deliveryIssueId?: string;
    userId: string;
    method: string;
    notes?: string;
  }) {
    // Validate shipment exists
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: acknowledgmentData.shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // Validate issue exists if provided
    if (acknowledgmentData.deliveryIssueId) {
      const issue = await this.prisma.deliveryIssue.findUnique({
        where: { id: acknowledgmentData.deliveryIssueId },
      });

      if (!issue) {
        throw new NotFoundException('Delivery issue not found');
      }
    }

    return this.prisma.acknowledgment.create({
      data: {
        shipmentId: acknowledgmentData.shipmentId,
        deliveryIssueId: acknowledgmentData.deliveryIssueId,
        userId: acknowledgmentData.userId,
        method: acknowledgmentData.method,
        notes: acknowledgmentData.notes,
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
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
          },
        },
        deliveryIssue: {
          select: {
            id: true,
            issueType: true,
            status: true,
          },
        },
      },
    });
  }

  async findByShipment(shipmentId: string) {
    return this.prisma.acknowledgment.findMany({
      where: { shipmentId },
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
        createdAt: 'desc',
      },
    });
  }

  async findByIssue(deliveryIssueId: string) {
    return this.prisma.acknowledgment.findMany({
      where: { deliveryIssueId },
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
        createdAt: 'desc',
      },
    });
  }
}
