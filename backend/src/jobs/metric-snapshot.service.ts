import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MetricSnapshotService {
  private readonly logger = new Logger(MetricSnapshotService.name);

  constructor(
    private prisma: PrismaService,
    private metricsService: MetricsService,
  ) {}

  /**
   * Hourly snapshot generation for real-time metrics
   * Runs every hour at minute 0
   */
  @Cron('0 * * * *') // Every hour at minute 0
  async generateHourlySnapshots() {
    this.logger.log('Starting hourly metric snapshot generation...');

    try {
      // Get all visible metric definitions
      const metricDefinitions = await this.prisma.metricDefinition.findMany({
        where: {
          isVisibleOnDashboard: true,
        },
      });

      if (metricDefinitions.length === 0) {
        this.logger.log('No metric definitions found for snapshot generation');
        return;
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      let generatedCount = 0;

      for (const metricDef of metricDefinitions) {
        try {
          await this.metricsService.generateSnapshot(
            metricDef.id,
            oneHourAgo,
            now,
            { type: 'global' },
          );
          generatedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to generate snapshot for metric ${metricDef.key}: ${error.message}`,
          );
        }
      }

      this.logger.log(`Hourly snapshot generation completed: ${generatedCount} snapshots created`);
    } catch (error) {
      this.logger.error(`Hourly snapshot generation failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Daily snapshot generation for historical metrics
   * Runs every day at 00:00 (midnight)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailySnapshots() {
    this.logger.log('Starting daily metric snapshot generation...');

    try {
      // Get all metric definitions (including non-visible for historical tracking)
      const metricDefinitions = await this.prisma.metricDefinition.findMany();

      if (metricDefinitions.length === 0) {
        this.logger.log('No metric definitions found for daily snapshot generation');
        return;
      }

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      let generatedCount = 0;

      // Generate snapshots for each dimension
      const dimensions: Array<{ type: 'global' | 'region' | 'route' | 'driver'; value?: string }> =
        [{ type: 'global' }];

      // Get regions for breakdown
      const regions = await this.prisma.route.findMany({
        select: { region: true },
        distinct: ['region'],
      });

      for (const region of regions) {
        dimensions.push({ type: 'region', value: region.region });
      }

      for (const metricDef of metricDefinitions) {
        for (const dimension of dimensions) {
          try {
            await this.metricsService.generateSnapshot(
              metricDef.id,
              oneDayAgo,
              now,
              dimension,
            );
            generatedCount++;
          } catch (error) {
            this.logger.error(
              `Failed to generate snapshot for metric ${metricDef.key} (dimension: ${dimension.type}): ${error.message}`,
            );
          }
        }
      }

      this.logger.log(
        `Daily snapshot generation completed: ${generatedCount} snapshots created`,
      );
    } catch (error) {
      this.logger.error(`Daily snapshot generation failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Manual trigger for testing/debugging
   */
  async runHourlySnapshot() {
    await this.generateHourlySnapshots();
  }

  /**
   * Manual trigger for testing/debugging
   */
  async runDailySnapshot() {
    await this.generateDailySnapshots();
  }
}
