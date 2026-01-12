import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebSocketRbacGuard implements CanActivate {
  private readonly logger = new Logger(WebSocketRbacGuard.name);
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const room = context.getArgByIndex(1); // Second argument is the room name

    const user = client.data.user;
    if (!user) {
      this.logger.warn(`WebSocket room join rejected: No user data for client ${client.id}`);
      throw new ForbiddenException('User not authenticated');
    }

    const userRole = user.role as Role;
    const userId = user.id;

    // RBAC rules for channel subscriptions
    if (room.startsWith('shipment:')) {
      const trackingNumber = room.replace('shipment:', '');
      // Customer: Can only subscribe to their own shipments
      if (userRole === Role.customer) {
        const shipment = await this.prisma.shipment.findUnique({
          where: { trackingNumber },
          select: { customerId: true },
        });
        if (!shipment || shipment.customerId !== userId) {
          this.logger.warn(`Customer ${userId} attempted to subscribe to shipment ${trackingNumber} they don't own`);
          throw new ForbiddenException('Access denied to this shipment channel');
        }
      }
      // Driver, Dispatcher, Manager, Admin: Can subscribe to any shipment
      this.logger.log(`User ${userId} (${userRole}) subscribed to shipment:${trackingNumber}`);
      return true;
    }

    if (room.startsWith('routes:')) {
      const routeCode = room.replace('routes:', '');
      // Driver: Can only subscribe to their assigned routes
      if (userRole === Role.driver) {
        const driverProfile = await this.prisma.driver.findFirst({
          where: { userId },
          select: { id: true },
        });
        if (driverProfile) {
          const route = await this.prisma.route.findFirst({
            where: {
              routeCode,
              driverId: driverProfile.id,
            },
          });
          if (!route) {
            this.logger.warn(`Driver ${userId} attempted to subscribe to route ${routeCode} they are not assigned to`);
            throw new ForbiddenException('Access denied to this route channel');
          }
        } else {
          throw new ForbiddenException('Driver profile not found');
        }
      }
      // Dispatcher, Manager, Admin: Can subscribe to any route
      this.logger.log(`User ${userId} (${userRole}) subscribed to routes:${routeCode}`);
      return true;
    }

    if (room === 'issues') {
      // Customer: Cannot subscribe to issues channel
      if (userRole === Role.customer) {
        this.logger.warn(`Customer ${userId} attempted to subscribe to issues channel`);
        throw new ForbiddenException('Access denied to issues channel');
      }
      // Driver, Dispatcher, Manager, Admin: Can subscribe
      this.logger.log(`User ${userId} (${userRole}) subscribed to issues channel`);
      return true;
    }

    if (room === 'escalations') {
      // Customer, Driver: Cannot subscribe to escalations channel
      if (userRole === Role.customer || userRole === Role.driver) {
        this.logger.warn(`User ${userId} (${userRole}) attempted to subscribe to escalations channel`);
        throw new ForbiddenException('Access denied to escalations channel');
      }
      // Dispatcher, Manager, Admin: Can subscribe
      this.logger.log(`User ${userId} (${userRole}) subscribed to escalations channel`);
      return true;
    }

    if (room === 'metrics:overview') {
      // Customer: Cannot subscribe to metrics channel
      if (userRole === Role.customer) {
        this.logger.warn(`Customer ${userId} attempted to subscribe to metrics channel`);
        throw new ForbiddenException('Access denied to metrics channel');
      }
      // Driver, Dispatcher, Manager, Admin: Can subscribe
      this.logger.log(`User ${userId} (${userRole}) subscribed to metrics:overview channel`);
      return true;
    }

    // Unknown room - deny by default
    this.logger.warn(`Unknown room attempted: ${room} by user ${userId} (${userRole})`);
    throw new ForbiddenException(`Access denied to room: ${room}`);
  }
}
