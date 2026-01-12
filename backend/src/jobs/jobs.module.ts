import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SlaRiskScannerService } from './sla-risk-scanner.service';
import { MetricSnapshotService } from './metric-snapshot.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EscalationsModule } from '../escalations/escalations.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    EscalationsModule,
    MetricsModule,
  ],
  providers: [SlaRiskScannerService, MetricSnapshotService],
  exports: [SlaRiskScannerService, MetricSnapshotService],
})
export class JobsModule {}
