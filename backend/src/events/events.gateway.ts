import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { WebSocketAuthGuard } from './websocket-auth.guard';
import { WebSocketRbacGuard } from './websocket-rbac.guard';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    // Try to authenticate on connection
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (token) {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET || 'secretKey',
        });
        client.data.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        };
        this.logger.log(`WebSocket client connected: ${client.data.user?.email || client.id} (${client.data.user?.role || 'unauthenticated'})`);
      } else {
        this.logger.warn(`WebSocket client connected without token: ${client.id}`);
      }
    } catch (error) {
      this.logger.warn(`WebSocket connection authentication failed for client ${client.id}: ${error.message}`);
      // Don't disconnect - allow connection but require auth for room joins
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user;
    this.logger.log(`WebSocket client disconnected: ${user?.email || client.id}`);
  }

  @UseGuards(WebSocketAuthGuard, WebSocketRbacGuard)
  @SubscribeMessage('joinRoom')
  @UsePipes(new ValidationPipe())
  async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
    await client.join(room);
    const user = client.data.user;
    this.logger.log(`User ${user.email} (${user.role}) joined room: ${room}`);
    return { success: true, room };
  }

  // Emit shipment.scan.created event to shipment channel
  emitShipmentScanCreated(trackingNumber: string, data: any) {
    const eventData = {
      event: 'shipment.scan.created',
      timestamp: new Date().toISOString(),
      data,
    };
    this.server.to(`shipment:${trackingNumber}`).emit('shipment.scan.created', eventData);
    this.logger.log(`Emitted shipment.scan.created for shipment ${trackingNumber}`);
  }

  // Emit shipment.status.updated event to shipment channel
  emitShipmentStatusUpdated(trackingNumber: string, data: any) {
    const eventData = {
      event: 'shipment.status.updated',
      timestamp: new Date().toISOString(),
      data,
    };
    this.server.to(`shipment:${trackingNumber}`).emit('shipment.status.updated', eventData);
    this.logger.log(`Emitted shipment.status.updated for shipment ${trackingNumber}`);
  }

  // Legacy method for backward compatibility - emits generic shipment.update
  emitShipmentUpdate(trackingNumber: string, data: any) {
    const eventType = data.type === 'scan.created' ? 'shipment.scan.created' : 'shipment.status.updated';
    if (eventType === 'shipment.scan.created') {
      this.emitShipmentScanCreated(trackingNumber, data);
    } else {
      this.emitShipmentStatusUpdated(trackingNumber, data);
    }
  }

  // Emit issue.created event to issues channel
  emitIssueCreated(data: any) {
    const eventData = {
      event: 'issue.created',
      timestamp: new Date().toISOString(),
      data,
    };
    this.server.to('issues').emit('issue.created', eventData);
    this.logger.log(`Emitted issue.created for issue ${data.id || 'unknown'}`);
  }

  // Emit issue.updated event to issues channel
  emitIssueUpdate(data: any) {
    const eventData = {
      event: 'issue.updated',
      timestamp: new Date().toISOString(),
      data,
    };
    this.server.to('issues').emit('issue.updated', eventData);
    this.logger.log(`Emitted issue.updated for issue ${data.id || 'unknown'}`);
  }

  // Emit escalation.triggered event to escalations channel
  emitEscalationTriggered(data: any) {
    const eventData = {
      event: 'escalation.triggered',
      timestamp: new Date().toISOString(),
      data,
    };
    this.server.to('escalations').emit('escalation.triggered', eventData);
    this.logger.log(`Emitted escalation.triggered for shipment ${data.shipmentId || 'unknown'}`);
  }

  // Emit escalation.advanced event to escalations channel
  emitEscalationAdvanced(data: any) {
    const eventData = {
      event: 'escalation.advanced',
      timestamp: new Date().toISOString(),
      data,
    };
    this.server.to('escalations').emit('escalation.advanced', eventData);
    this.logger.log(`Emitted escalation.advanced for shipment ${data.shipmentId || 'unknown'}`);
  }

  // Emit escalation.acknowledged event to escalations channel
  emitEscalationAcknowledged(data: any) {
    const eventData = {
      event: 'escalation.acknowledged',
      timestamp: new Date().toISOString(),
      data,
    };
    this.server.to('escalations').emit('escalation.acknowledged', eventData);
    this.logger.log(`Emitted escalation.acknowledged for shipment ${data.shipmentId || 'unknown'}`);
  }

  // Emit metrics.snapshot.created event to metrics:overview channel
  emitMetricsSnapshotCreated(data: any) {
    const eventData = {
      event: 'metrics.snapshot.created',
      timestamp: new Date().toISOString(),
      data,
    };
    this.server.to('metrics:overview').emit('metrics.snapshot.created', eventData);
    this.logger.log(`Emitted metrics.snapshot.created for metric ${data.metricId || 'unknown'}`);
  }

  // Emit delivery_change_request.created event to shipment channel and delivery-changes channel
  emitDeliveryChangeRequestCreated(trackingNumber: string, data: any) {
    const eventData = {
      event: 'delivery_change_request.created',
      timestamp: new Date().toISOString(),
      data,
    };
    this.server.to(`shipment:${trackingNumber}`).emit('delivery_change_request.created', eventData);
    this.server.to('delivery-changes').emit('delivery_change_request.created', eventData);
    this.logger.log(`Emitted delivery_change_request.created for shipment ${trackingNumber}`);
  }

  // Emit delivery_change_request.updated event to shipment channel and delivery-changes channel
  emitDeliveryChangeRequestUpdated(trackingNumber: string, data: any) {
    const eventData = {
      event: 'delivery_change_request.updated',
      timestamp: new Date().toISOString(),
      data,
    };
    this.server.to(`shipment:${trackingNumber}`).emit('delivery_change_request.updated', eventData);
    this.server.to('delivery-changes').emit('delivery_change_request.updated', eventData);
    this.logger.log(`Emitted delivery_change_request.updated for shipment ${trackingNumber}`);
  }
}
