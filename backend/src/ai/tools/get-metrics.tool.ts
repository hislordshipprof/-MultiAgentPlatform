import { Injectable } from '@nestjs/common';
import { MetricsService } from '../../metrics/metrics.service';

export interface GetMetricsInput {
  metricKey?: string;
  dimension?: 'global' | 'region' | 'route' | 'driver';
  dimensionValue?: string;
}

export interface GetMetricsOutput {
  success: boolean;
  metrics?: {
    onTimeDeliveryRate?: number;
    firstAttemptSuccessRate?: number;
    openIssuesCount?: number;
    slaRiskCount?: number;
  };
  error?: string;
}

@Injectable()
export class GetMetricsTool {
  constructor(private metricsService: MetricsService) {}

  async execute(input: GetMetricsInput): Promise<GetMetricsOutput> {
    try {
      // If metricKey is provided, compute specific metric
      if (input.metricKey) {
        const metricDef = await this.metricsService.findAllDefinitions();
        const def = metricDef.find((m) => m.key === input.metricKey);

        if (!def) {
          return {
            success: false,
            error: `Metric with key "${input.metricKey}" not found`,
          };
        }

        const dimension = input.dimension
          ? { type: input.dimension, value: input.dimensionValue }
          : undefined;

        const result = await this.metricsService.computeMetric(def.id, dimension);

        return {
          success: true,
          metrics: {
            [input.metricKey]: result.value,
          },
        };
      }

      // Otherwise, return overview KPIs
      const dimension = input.dimension
        ? { type: input.dimension, value: input.dimensionValue }
        : undefined;

      const overview = await this.metricsService.getOverview();

      return {
        success: true,
        metrics: {
          onTimeDeliveryRate: overview.onTimeDeliveryRate,
          firstAttemptSuccessRate: overview.firstAttemptSuccessRate,
          openIssuesCount: overview.openIssuesCount,
          slaRiskCount: overview.slaRiskCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Error getting metrics: ${error.message}`,
      };
    }
  }

  getDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: 'get_metrics',
        description:
          'Get operational metrics (on-time delivery rate, first-attempt success rate, open issues count, SLA-risk count). Can filter by dimension (global, region, route, driver).',
        parameters: {
          type: 'object',
          properties: {
            metricKey: {
              type: 'string',
              description:
                'Optional specific metric key (e.g., on_time_delivery_rate, first_attempt_success_rate). If not provided, returns all overview KPIs.',
            },
            dimension: {
              type: 'string',
              enum: ['global', 'region', 'route', 'driver'],
              description: 'Optional dimension to filter by (global, region, route, or driver)',
            },
            dimensionValue: {
              type: 'string',
              description:
                'Required if dimension is provided. For region: region name. For route: route ID. For driver: driver ID.',
            },
          },
          required: [],
        },
      },
    };
  }
}
