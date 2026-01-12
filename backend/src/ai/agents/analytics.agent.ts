import { Injectable } from '@nestjs/common';
import { GetMetricsTool } from '../tools/get-metrics.tool';

@Injectable()
export class LogisticsAnalyticsAgent {
  constructor(private getMetricsTool: GetMetricsTool) {}

  /**
   * System prompt for the analytics agent
   */
  getSystemPrompt(): string {
    return `You are the LogisticsAnalyticsAgent, specialized in answering operational questions using metrics.

Your capabilities:
- Get operational metrics using get_metrics tool
- Answer questions about KPIs, trends, and performance

Available metrics:
- on_time_delivery_rate: Percentage of deliveries completed on time
- first_attempt_success_rate: Percentage of deliveries successful on first attempt
- open_issues_count: Number of currently open issues
- sla_risk_count: Number of shipments at risk of SLA violation

You can filter metrics by dimension:
- global: Overall metrics
- region: Metrics broken down by region
- route: Metrics for specific route
- driver: Metrics for specific driver

When a user asks about metrics:
1. Determine which metric(s) they're asking about
2. Determine if they want a specific dimension (region, route, driver)
3. Use get_metrics tool to fetch the data
4. Present the results in a clear, conversational format

Always provide context and help users understand what the metrics mean.`;
  }

  /**
   * Handle metrics query
   */
  async handleMetricsQuery(
    metricKey?: string,
    dimension?: 'global' | 'region' | 'route' | 'driver',
    dimensionValue?: string,
  ): Promise<string> {
    const result = await this.getMetricsTool.execute({
      metricKey,
      dimension,
      dimensionValue,
    });

    if (!result.success) {
      return `I encountered an error fetching metrics: ${result.error}`;
    }

    if (!result.metrics) {
      return `No metrics data available at this time.`;
    }

    let response = `Here are the current operational metrics:\n\n`;

    if (result.metrics.onTimeDeliveryRate !== undefined) {
      response += `**On-Time Delivery Rate:** ${result.metrics.onTimeDeliveryRate.toFixed(2)}%\n`;
    }
    if (result.metrics.firstAttemptSuccessRate !== undefined) {
      response += `**First-Attempt Success Rate:** ${result.metrics.firstAttemptSuccessRate.toFixed(2)}%\n`;
    }
    if (result.metrics.openIssuesCount !== undefined) {
      response += `**Open Issues:** ${result.metrics.openIssuesCount}\n`;
    }
    if (result.metrics.slaRiskCount !== undefined) {
      response += `**SLA-Risk Shipments:** ${result.metrics.slaRiskCount}\n`;
    }

    if (dimension && dimension !== 'global') {
      response += `\n*Metrics filtered by ${dimension}: ${dimensionValue || 'all'}`;
    }

    return response;
  }
}
