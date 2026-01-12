import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateMetricDefinitionDto } from './dto/create-metric-definition.dto';
import { UpdateMetricDefinitionDto } from './dto/update-metric-definition.dto';
import { ShipmentStatus, ScanType } from '@prisma/client';

@Injectable()
export class MetricsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  /**
   * Calculate on-time delivery rate
   * Formula: (delivered on or before promisedDeliveryDate) / (total delivered shipments)
   */
  async calculateOnTimeDeliveryRate(
    dimension?: { type: 'global' | 'region' | 'route' | 'driver'; value?: string },
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ value: number; breakdown?: any }> {
    const where: any = {
      currentStatus: ShipmentStatus.delivered,
    };

    if (startDate || endDate) {
      where.updatedAt = {};
      if (startDate) where.updatedAt.gte = startDate;
      if (endDate) where.updatedAt.lte = endDate;
    }

    // Apply dimension filter
    if (dimension) {
      switch (dimension.type) {
        case 'region': {
          // Get shipments via RouteStop -> Route
          const routes = await this.prisma.route.findMany({
            where: { region: dimension.value },
            select: { id: true },
          });
          const routeIds = routes.map((r) => r.id);
          const stops = await this.prisma.routeStop.findMany({
            where: { routeId: { in: routeIds } },
            select: { shipmentId: true },
          });
          const shipmentIds = [...new Set(stops.map((s) => s.shipmentId))];
          where.id = { in: shipmentIds };
          break;
        }
        case 'route': {
          const stops = await this.prisma.routeStop.findMany({
            where: { routeId: dimension.value },
            select: { shipmentId: true },
          });
          const shipmentIds = [...new Set(stops.map((s) => s.shipmentId))];
          where.id = { in: shipmentIds };
          break;
        }
        case 'driver': {
          const routes = await this.prisma.route.findMany({
            where: { driverId: dimension.value },
            select: { id: true },
          });
          const routeIds = routes.map((r) => r.id);
          const stops = await this.prisma.routeStop.findMany({
            where: { routeId: { in: routeIds } },
            select: { shipmentId: true },
          });
          const shipmentIds = [...new Set(stops.map((s) => s.shipmentId))];
          where.id = { in: shipmentIds };
          break;
        }
      }
    }

    const deliveredShipments = await this.prisma.shipment.findMany({
      where,
      select: {
        id: true,
        promisedDeliveryDate: true,
        updatedAt: true,
      },
    });

    if (deliveredShipments.length === 0) {
      return { value: 0 };
    }

    const onTimeCount = deliveredShipments.filter((s) => {
      if (!s.promisedDeliveryDate) return false;
      const deliveryDate = new Date(s.updatedAt);
      const promisedDate = new Date(s.promisedDeliveryDate);
      return deliveryDate <= promisedDate;
    }).length;

    const rate = onTimeCount / deliveredShipments.length;

    // Calculate breakdown by region if global
    let breakdown = undefined;
    if (!dimension || dimension.type === 'global') {
      const regions = await this.prisma.route.findMany({
        select: { region: true },
        distinct: ['region'],
      });

      breakdown = {} as Record<string, number>;
      for (const region of regions) {
        const regionMetric = await this.calculateOnTimeDeliveryRate(
          { type: 'region', value: region.region },
          startDate,
          endDate,
        );
        breakdown[region.region] = regionMetric.value;
      }
    }

    return {
      value: Math.round(rate * 100) / 100, // Round to 2 decimal places as decimal (0-1 range)
      breakdown,
    };
  }

  /**
   * Calculate first-attempt success rate
   * Formula: (delivered on first attempt) / (total delivery attempts)
   */
  async calculateFirstAttemptSuccessRate(
    dimension?: { type: 'global' | 'region' | 'route' | 'driver'; value?: string },
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ value: number; breakdown?: any }> {
    const where: any = {
      currentStatus: ShipmentStatus.delivered,
    };

    if (startDate || endDate) {
      where.updatedAt = {};
      if (startDate) where.updatedAt.gte = startDate;
      if (endDate) where.updatedAt.lte = endDate;
    }

    // Apply dimension filter (same as on-time delivery)
    if (dimension) {
      switch (dimension.type) {
        case 'region': {
          const routes = await this.prisma.route.findMany({
            where: { region: dimension.value },
            select: { id: true },
          });
          const routeIds = routes.map((r) => r.id);
          const stops = await this.prisma.routeStop.findMany({
            where: { routeId: { in: routeIds } },
            select: { shipmentId: true },
          });
          const shipmentIds = [...new Set(stops.map((s) => s.shipmentId))];
          where.id = { in: shipmentIds };
          break;
        }
        case 'route': {
          const stops = await this.prisma.routeStop.findMany({
            where: { routeId: dimension.value },
            select: { shipmentId: true },
          });
          const shipmentIds = [...new Set(stops.map((s) => s.shipmentId))];
          where.id = { in: shipmentIds };
          break;
        }
        case 'driver': {
          const routes = await this.prisma.route.findMany({
            where: { driverId: dimension.value },
            select: { id: true },
          });
          const routeIds = routes.map((r) => r.id);
          const stops = await this.prisma.routeStop.findMany({
            where: { routeId: { in: routeIds } },
            select: { shipmentId: true },
          });
          const shipmentIds = [...new Set(stops.map((s) => s.shipmentId))];
          where.id = { in: shipmentIds };
          break;
        }
      }
    }

    const deliveredShipments = await this.prisma.shipment.findMany({
      where,
      include: {
        scans: {
          where: {
            scanType: {
              in: [ScanType.delivered, ScanType.failed_attempt],
            },
          },
        },
      },
    });

    if (deliveredShipments.length === 0) {
      return { value: 0 };
    }

    let firstAttemptCount = 0;
    let totalAttempts = 0;

    for (const shipment of deliveredShipments) {
      const deliveryScans = shipment.scans.filter((s) => s.scanType === ScanType.delivered || s.scanType === ScanType.failed_attempt);
      totalAttempts += deliveryScans.length;

      // Check if first delivery-related scan was successful
      if (deliveryScans.length > 0 && deliveryScans[0].scanType === ScanType.delivered) {
        firstAttemptCount++;
      }
    }

    const rate = totalAttempts > 0 ? firstAttemptCount / totalAttempts : 0;

    // Calculate breakdown by region if global
    let breakdown = undefined;
    if (!dimension || dimension.type === 'global') {
      const regions = await this.prisma.route.findMany({
        select: { region: true },
        distinct: ['region'],
      });

      breakdown = {} as Record<string, number>;
      for (const region of regions) {
        const regionMetric = await this.calculateFirstAttemptSuccessRate(
          { type: 'region', value: region.region },
          startDate,
          endDate,
        );
        breakdown[region.region] = regionMetric.value;
      }
    }

    return {
      value: Math.round(rate * 100) / 100, // Round to 2 decimal places as decimal (0-1 range)
      breakdown,
    };
  }

  /**
   * Calculate open issues count
   */
  async calculateOpenIssuesCount(
    dimension?: { type: 'global' | 'region' | 'route' | 'driver'; value?: string },
  ): Promise<{ value: number; breakdown?: any }> {
    const where: any = {
      status: {
        in: ['open', 'investigating'],
      },
    };

    // Apply dimension filter via shipment routes
    if (dimension && dimension.type !== 'global') {
      const shipmentIds = await this.getShipmentIdsByDimension(dimension);
      where.shipmentId = { in: shipmentIds };
    }

    const openIssues = await this.prisma.deliveryIssue.findMany({
      where,
      select: {
        id: true,
        shipmentId: true,
      },
    });

    const count = openIssues.length;

    // Calculate breakdown by region if global
    let breakdown = undefined;
    if (!dimension || dimension.type === 'global') {
      const regions = await this.prisma.route.findMany({
        select: { region: true },
        distinct: ['region'],
      });

      breakdown = {} as Record<string, number>;
      for (const region of regions) {
        const regionMetric = await this.calculateOpenIssuesCount({
          type: 'region',
          value: region.region,
        });
        breakdown[region.region] = regionMetric.value;
      }
    }

    return { value: count, breakdown };
  }

  /**
   * Calculate SLA-risk count
   * Formula: Count of shipments with slaRiskScore > threshold (default 0.7)
   */
  async calculateSlaRiskCount(
    threshold: number = 0.7,
    dimension?: { type: 'global' | 'region' | 'route' | 'driver'; value?: string },
  ): Promise<{ value: number; breakdown?: any }> {
    const where: any = {
      slaRiskScore: { gt: threshold },
    };

    // Apply dimension filter
    if (dimension && dimension.type !== 'global') {
      const shipmentIds = await this.getShipmentIdsByDimension(dimension);
      where.id = { in: shipmentIds };
    }

    const slaRiskShipments = await this.prisma.shipment.findMany({
      where,
      select: {
        id: true,
      },
    });

    const count = slaRiskShipments.length;

    // Calculate breakdown by region if global
    let breakdown = undefined;
    if (!dimension || dimension.type === 'global') {
      const regions = await this.prisma.route.findMany({
        select: { region: true },
        distinct: ['region'],
      });

      breakdown = {} as Record<string, number>;
      for (const region of regions) {
        const regionMetric = await this.calculateSlaRiskCount(threshold, {
          type: 'region',
          value: region.region,
        });
        breakdown[region.region] = regionMetric.value;
      }
    }

    return { value: count, breakdown };
  }

  /**
   * Helper: Get shipment IDs by dimension
   */
  private async getShipmentIdsByDimension(
    dimension: { type: 'global' | 'region' | 'route' | 'driver'; value?: string },
  ): Promise<string[]> {
    if (dimension.type === 'global') {
      // Return all shipment IDs for global
      const shipments = await this.prisma.shipment.findMany({
        select: { id: true },
      });
      return shipments.map((s) => s.id);
    }

    if (!dimension.value) {
      return [];
    }
    switch (dimension.type) {
      case 'region': {
        const routes = await this.prisma.route.findMany({
          where: { region: dimension.value },
          select: { id: true },
        });
        const routeIds = routes.map((r) => r.id);
        const stops = await this.prisma.routeStop.findMany({
          where: { routeId: { in: routeIds } },
          select: { shipmentId: true },
        });
        return [...new Set(stops.map((s) => s.shipmentId))];
      }
      case 'route': {
        const stops = await this.prisma.routeStop.findMany({
          where: { routeId: dimension.value },
          select: { shipmentId: true },
        });
        return [...new Set(stops.map((s) => s.shipmentId))];
      }
      case 'driver': {
        const routes = await this.prisma.route.findMany({
          where: { driverId: dimension.value },
          select: { id: true },
        });
        const routeIds = routes.map((r) => r.id);
        const stops = await this.prisma.routeStop.findMany({
          where: { routeId: { in: routeIds } },
          select: { shipmentId: true },
        });
        return [...new Set(stops.map((s) => s.shipmentId))];
      }
      default:
        return [];
    }
  }

  /**
   * Get overview KPIs
   */
  async getOverview(timeRange?: { start?: Date; end?: Date }) {
    const [onTimeRate, firstAttemptRate, openIssues, slaRisk] = await Promise.all([
      this.calculateOnTimeDeliveryRate(undefined, timeRange?.start, timeRange?.end),
      this.calculateFirstAttemptSuccessRate(undefined, timeRange?.start, timeRange?.end),
      this.calculateOpenIssuesCount(),
      this.calculateSlaRiskCount(0.7),
    ]);

    return {
      onTimeDeliveryRate: onTimeRate.value,
      onTimeDeliveryRateBreakdown: onTimeRate.breakdown,
      firstAttemptSuccessRate: firstAttemptRate.value,
      firstAttemptSuccessRateBreakdown: firstAttemptRate.breakdown,
      openIssuesCount: openIssues.value,
      openIssuesCountBreakdown: openIssues.breakdown,
      slaRiskCount: slaRisk.value,
      slaRiskCountBreakdown: slaRisk.breakdown,
      computedAt: new Date(),
    };
  }

  /**
   * Compute metric by definition
   */
  async computeMetric(
    metricDefinitionId: string,
    dimension?: { type: 'global' | 'region' | 'route' | 'driver'; value?: string },
    timeRange?: { start?: Date; end?: Date },
  ): Promise<{ value: number; breakdown?: any }> {
    const metricDef = await this.prisma.metricDefinition.findUnique({
      where: { id: metricDefinitionId },
    });

    if (!metricDef) {
      throw new NotFoundException('Metric definition not found');
    }

    let result: { value: number; breakdown?: any };

    // Compute based on metric key or aggregation type
    switch (metricDef.key) {
      case 'on_time_delivery_rate':
        result = await this.calculateOnTimeDeliveryRate(dimension, timeRange?.start, timeRange?.end);
        break;
      case 'first_attempt_success_rate':
        result = await this.calculateFirstAttemptSuccessRate(dimension, timeRange?.start, timeRange?.end);
        break;
      case 'open_issues_count':
        result = await this.calculateOpenIssuesCount(dimension);
        break;
      case 'sla_risk_count':
        result = await this.calculateSlaRiskCount(0.7, dimension);
        break;
      default:
        // For custom metrics, return 0 (would need custom computation logic)
        result = { value: 0 };
    }

    return result;
  }

  /**
   * Generate metric snapshot
   */
  async generateSnapshot(
    metricDefinitionId: string,
    timeRangeStart: Date,
    timeRangeEnd: Date,
    dimension?: { type: 'global' | 'region' | 'route' | 'driver'; value?: string },
  ) {
    const metricDef = await this.prisma.metricDefinition.findUnique({
      where: { id: metricDefinitionId },
    });

    if (!metricDef) {
      throw new NotFoundException('Metric definition not found');
    }

    const result = await this.computeMetric(metricDefinitionId, dimension, {
      start: timeRangeStart,
      end: timeRangeEnd,
    });

    const snapshot = await this.prisma.metricSnapshot.create({
      data: {
        metricId: metricDefinitionId,
        value: result.value,
        timeRangeStart,
        timeRangeEnd,
        computedAt: new Date(),
        breakdown: result.breakdown || null,
      },
      include: {
        metric: true,
      },
    });

    // Emit WebSocket event
    this.eventsGateway.emitMetricsSnapshotCreated(snapshot);

    return snapshot;
  }

  async findAllDefinitions() {
    return this.prisma.metricDefinition.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOneDefinition(id: string) {
    const definition = await this.prisma.metricDefinition.findUnique({
      where: { id },
      include: {
        snapshots: {
          orderBy: {
            computedAt: 'desc',
          },
          take: 10, // Latest 10 snapshots
        },
      },
    });

    if (!definition) {
      throw new NotFoundException('Metric definition not found');
    }

    return definition;
  }

  async createDefinition(createDto: CreateMetricDefinitionDto) {
    // Check if key already exists
    const existing = await this.prisma.metricDefinition.findUnique({
      where: { key: createDto.key },
    });

    if (existing) {
      throw new BadRequestException('Metric key already exists');
    }

    return this.prisma.metricDefinition.create({
      data: {
        key: createDto.key,
        name: createDto.name,
        description: createDto.description,
        aggregationType: createDto.aggregationType,
        dimension: createDto.dimension,
        targetValue: createDto.targetValue,
        warningThreshold: createDto.warningThreshold,
        criticalThreshold: createDto.criticalThreshold,
        ownerRole: createDto.ownerRole || 'admin',
        isVisibleOnDashboard: createDto.isVisibleOnDashboard !== undefined ? createDto.isVisibleOnDashboard : true,
      },
    });
  }

  async updateDefinition(id: string, updateDto: UpdateMetricDefinitionDto) {
    const definition = await this.prisma.metricDefinition.findUnique({
      where: { id },
    });

    if (!definition) {
      throw new NotFoundException('Metric definition not found');
    }

    return this.prisma.metricDefinition.update({
      where: { id },
      data: updateDto,
    });
  }

  async deleteDefinition(id: string) {
    const definition = await this.prisma.metricDefinition.findUnique({
      where: { id },
    });

    if (!definition) {
      throw new NotFoundException('Metric definition not found');
    }

    // Delete all snapshots associated with this metric
    await this.prisma.metricSnapshot.deleteMany({
      where: { metricId: id },
    });

    // Delete the metric definition
    return this.prisma.metricDefinition.delete({
      where: { id },
    });
  }

  async findAllSnapshots(filters?: { metricId?: string; startDate?: Date; endDate?: Date }) {
    const where: any = {};

    if (filters?.metricId) {
      where.metricId = filters.metricId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.computedAt = {};
      if (filters.startDate) where.computedAt.gte = filters.startDate;
      if (filters.endDate) where.computedAt.lte = filters.endDate;
    }

    return this.prisma.metricSnapshot.findMany({
      where,
      include: {
        metric: true,
      },
      orderBy: {
        computedAt: 'desc',
      },
    });
  }

  async findSnapshotsByMetric(metricId: string) {
    return this.prisma.metricSnapshot.findMany({
      where: { metricId },
      include: {
        metric: true,
      },
      orderBy: {
        computedAt: 'desc',
      },
    });
  }
}
