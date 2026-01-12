import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { WebSocketAuthGuard } from './websocket-auth.guard';
import { WebSocketRbacGuard } from './websocket-rbac.guard';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [AuthModule, PrismaModule],
  providers: [EventsGateway, WebSocketAuthGuard, WebSocketRbacGuard],
  exports: [EventsGateway, WebSocketAuthGuard, WebSocketRbacGuard],
})
export class EventsModule {}
