import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { RoutesModule } from './routes/routes.module';
import { IssuesModule } from './issues/issues.module';
import { EscalationsModule } from './escalations/escalations.module';
import { MetricsModule } from './metrics/metrics.module';
import { AgentSessionsModule } from './agent-sessions/agent-sessions.module';
import { EventsModule } from './events/events.module';
import { JobsModule } from './jobs/jobs.module';
import { AiModule } from './ai/ai.module';
import { DeliveryChangesModule } from './delivery-changes/delivery-changes.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, ShipmentsModule, RoutesModule, IssuesModule, EscalationsModule, MetricsModule, AgentSessionsModule, EventsModule, JobsModule, AiModule, DeliveryChangesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
