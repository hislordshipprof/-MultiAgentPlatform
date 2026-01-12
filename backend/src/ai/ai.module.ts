import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { AiToolsService } from './ai-tools.service';
import { LogisticsRouterAgent } from './agents/router.agent';
import { ShipmentTrackingAgent } from './agents/tracking.agent';
import { DeliveryIssueAgent } from './agents/issue.agent';
import { DeliveryChangeAgent } from './agents/change.agent';
import { LogisticsAnalyticsAgent } from './agents/analytics.agent';
import { LogisticsEscalationAgent } from './agents/escalation.agent';
import { TrackShipmentTool } from './tools/track-shipment.tool';
import { CreateIssueTool } from './tools/create-issue.tool';
import { RequestDeliveryChangeTool } from './tools/request-delivery-change.tool';
import { GetShipmentTimelineTool } from './tools/get-shipment-timeline.tool';
import { GetMetricsTool } from './tools/get-metrics.tool';
import { ShipmentsModule } from '../shipments/shipments.module';
import { IssuesModule } from '../issues/issues.module';
import { MetricsModule } from '../metrics/metrics.module';
import { AgentSessionsModule } from '../agent-sessions/agent-sessions.module';
import { EscalationsModule } from '../escalations/escalations.module';
import { DeliveryChangesModule } from '../delivery-changes/delivery-changes.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ShipmentsModule,
    IssuesModule,
    MetricsModule,
    AgentSessionsModule,
    EscalationsModule,
    DeliveryChangesModule,
    PrismaModule,
  ],
  providers: [
    AiService,
    AiOrchestratorService,
    AiToolsService,
    LogisticsRouterAgent,
    ShipmentTrackingAgent,
    DeliveryIssueAgent,
    DeliveryChangeAgent,
    LogisticsAnalyticsAgent,
    LogisticsEscalationAgent,
    TrackShipmentTool,
    CreateIssueTool,
    RequestDeliveryChangeTool,
    GetShipmentTimelineTool,
    GetMetricsTool,
  ],
  controllers: [AiController],
  exports: [AiService, AiOrchestratorService, LogisticsEscalationAgent],
})
export class AiModule {}
