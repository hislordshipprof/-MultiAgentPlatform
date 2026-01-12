import { Injectable } from '@nestjs/common';
import { TrackShipmentTool } from './tools/track-shipment.tool';
import { CreateIssueTool } from './tools/create-issue.tool';
import { RequestDeliveryChangeTool } from './tools/request-delivery-change.tool';
import { GetShipmentTimelineTool } from './tools/get-shipment-timeline.tool';
import { GetMetricsTool } from './tools/get-metrics.tool';

export type ToolName =
  | 'track_shipment'
  | 'create_delivery_issue'
  | 'request_delivery_change'
  | 'get_shipment_timeline'
  | 'get_metrics';

@Injectable()
export class AiToolsService {
  private tools: Map<ToolName, any>;

  constructor(
    private trackShipmentTool: TrackShipmentTool,
    private createIssueTool: CreateIssueTool,
    private requestDeliveryChangeTool: RequestDeliveryChangeTool,
    private getShipmentTimelineTool: GetShipmentTimelineTool,
    private getMetricsTool: GetMetricsTool,
  ) {
    this.tools = new Map();
    this.tools.set('track_shipment', trackShipmentTool);
    this.tools.set('create_delivery_issue', createIssueTool);
    this.tools.set('request_delivery_change', requestDeliveryChangeTool);
    this.tools.set('get_shipment_timeline', getShipmentTimelineTool);
    this.tools.set('get_metrics', getMetricsTool);
  }

  /**
   * Get all tool definitions for OpenAI
   */
  getToolDefinitions() {
    return [
      this.trackShipmentTool.getDefinition(),
      this.createIssueTool.getDefinition(),
      this.requestDeliveryChangeTool.getDefinition(),
      this.getShipmentTimelineTool.getDefinition(),
      this.getMetricsTool.getDefinition(),
    ];
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, input: any, userId?: string): Promise<any> {
    const tool = this.tools.get(toolName as ToolName);

    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    // Special handling for tools that require userId
    if (toolName === 'create_delivery_issue') {
      if (!userId) {
        throw new Error('userId is required for create_delivery_issue tool');
      }
      return tool.execute(userId, input);
    }

    if (toolName === 'request_delivery_change') {
      if (!userId) {
        throw new Error('userId is required for request_delivery_change tool');
      }
      return tool.execute({ ...input, userId });
    }

    // All other tools don't need userId
    return tool.execute(input);
  }

  /**
   * Check if a tool exists
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName as ToolName);
  }
}
