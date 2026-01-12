import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateDeliveryChangeDto } from './dto/create-delivery-change.dto';
import { UpdateDeliveryChangeDto } from './dto/update-delivery-change.dto';
import { FilterDeliveryChangesDto } from './dto/filter-delivery-changes.dto';
import { Role, DeliveryChangeStatus, ShipmentStatus } from '@prisma/client';

@Injectable()
export class DeliveryChangesService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(createDto: CreateDeliveryChangeDto, userId: string, userRole: Role) {
    // Validate shipment exists
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: createDto.shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // RBAC: Customers can only create change requests for their own shipments
    if (userRole === Role.customer && shipment.customerId !== userId) {
      throw new ForbiddenException('You can only request changes for your own shipments');
    }

    // Validate shipment can be changed
    if (shipment.currentStatus === ShipmentStatus.delivered || shipment.currentStatus === ShipmentStatus.returned) {
      throw new BadRequestException(`Cannot change delivery for shipment with status: ${shipment.currentStatus}`);
    }

    // Parse newDate if provided
    let parsedDate: Date | null = null;
    if (createDto.newDate) {
      parsedDate = new Date(createDto.newDate);
      if (isNaN(parsedDate.getTime())) {
        throw new BadRequestException('Invalid date format');
      }
    } else if (createDto.changeType === 'reschedule') {
      // Try to parse from newValue if it's a date string
      const dateFromValue = new Date(createDto.newValue);
      if (!isNaN(dateFromValue.getTime())) {
        parsedDate = dateFromValue;
      }
    }

    // Create the change request
    const changeRequest = await this.prisma.deliveryChangeRequest.create({
      data: {
        shipmentId: createDto.shipmentId,
        requestedByUserId: userId,
        changeType: createDto.changeType,
        newValue: createDto.newValue,
        newDate: parsedDate,
        status: DeliveryChangeStatus.pending,
        notes: createDto.notes,
      },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            currentStatus: true,
            toAddress: true,
            promisedDeliveryDate: true,
          },
        },
        requestedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Emit WebSocket event
    this.eventsGateway.emitDeliveryChangeRequestCreated(changeRequest.shipment.trackingNumber, {
      id: changeRequest.id,
      shipmentId: changeRequest.shipmentId,
      trackingNumber: changeRequest.shipment.trackingNumber,
      changeType: changeRequest.changeType,
      status: changeRequest.status,
      requestedBy: {
        id: changeRequest.requestedByUser.id,
        name: changeRequest.requestedByUser.name,
        email: changeRequest.requestedByUser.email,
      },
    });

    return changeRequest;
  }

  async findAll(filters: FilterDeliveryChangesDto, userRole: Role, userId?: string) {
    const where: any = {};

    if (filters.shipmentId) {
      where.shipmentId = filters.shipmentId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.changeType) {
      where.changeType = filters.changeType;
    }

    // RBAC: Customers can only see their own change requests
    if (userRole === Role.customer) {
      where.requestedByUserId = userId;
    }

    return this.prisma.deliveryChangeRequest.findMany({
      where,
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            currentStatus: true,
            toAddress: true,
            promisedDeliveryDate: true,
          },
        },
        requestedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedByUser: {
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

  async findOne(id: string, userRole: Role, userId?: string) {
    const changeRequest = await this.prisma.deliveryChangeRequest.findUnique({
      where: { id },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            currentStatus: true,
            toAddress: true,
            promisedDeliveryDate: true,
            customerId: true,
          },
        },
        requestedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!changeRequest) {
      throw new NotFoundException('Delivery change request not found');
    }

    // RBAC: Customers can only view their own change requests
    if (userRole === Role.customer && changeRequest.requestedByUserId !== userId) {
      throw new ForbiddenException('You can only view your own change requests');
    }

    return changeRequest;
  }

  async update(id: string, updateDto: UpdateDeliveryChangeDto, userId: string, userRole: Role) {
    const changeRequest = await this.findOne(id, userRole, userId);

    // Only managers and admins can approve/reject change requests
    if (userRole !== Role.manager && userRole !== Role.admin) {
      throw new ForbiddenException('Only managers and admins can review change requests');
    }

    // Update the change request
    const updated = await this.prisma.deliveryChangeRequest.update({
      where: { id },
      data: {
        status: updateDto.status,
        notes: updateDto.notes,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
      },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            currentStatus: true,
          },
        },
        requestedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // If approved, apply the change to the shipment
    if (updateDto.status === DeliveryChangeStatus.approved) {
      await this.applyChange(updated);
    }

    // Emit WebSocket event
    this.eventsGateway.emitDeliveryChangeRequestUpdated(updated.shipment.trackingNumber, {
      id: updated.id,
      shipmentId: updated.shipmentId,
      trackingNumber: updated.shipment.trackingNumber,
      changeType: updated.changeType,
      status: updated.status,
      reviewedBy: {
        id: updated.reviewedByUser!.id,
        name: updated.reviewedByUser!.name,
        email: updated.reviewedByUser!.email,
      },
    });

    return updated;
  }

  private async applyChange(changeRequest: any) {
    const updateData: any = {};

    switch (changeRequest.changeType) {
      case 'reschedule':
        if (changeRequest.newDate) {
          updateData.promisedDeliveryDate = changeRequest.newDate;
        }
        break;
      case 'update_instructions':
        // Store instructions in a notes field or separate table
        // For now, we'll just mark it as applied
        break;
      case 'change_address':
        updateData.toAddress = changeRequest.newValue;
        break;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.shipment.update({
        where: { id: changeRequest.shipmentId },
        data: updateData,
      });

      // Update status to applied
      await this.prisma.deliveryChangeRequest.update({
        where: { id: changeRequest.id },
        data: { status: DeliveryChangeStatus.applied },
      });

      // Emit shipment update event
      this.eventsGateway.emitShipmentStatusUpdated(changeRequest.shipment.trackingNumber, {
        shipmentId: changeRequest.shipmentId,
        trackingNumber: changeRequest.shipment.trackingNumber,
        changes: updateData,
      });
    }
  }
}
