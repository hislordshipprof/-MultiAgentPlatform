import { Injectable } from '@nestjs/common';
import { TrackShipmentTool } from '../tools/track-shipment.tool';
import { GetShipmentTimelineTool } from '../tools/get-shipment-timeline.tool';

@Injectable()
export class ShipmentTrackingAgent {
  constructor(
    private trackShipmentTool: TrackShipmentTool,
    private getShipmentTimelineTool: GetShipmentTimelineTool,
  ) {}

  /**
   * System prompt for the tracking agent
   */
  getSystemPrompt(): string {
    return `You are the ShipmentTrackingAgent, specialized in helping customers track their shipments.

Your capabilities:
- Track shipments by tracking number using the track_shipment tool
- Get detailed shipment timelines using the get_shipment_timeline tool

When a user asks about a shipment:
1. Extract the tracking number from their message (format: TRK-XXXXX-XXXXX or TRK-XXXXX)
2. Use track_shipment tool to get current status and location
3. Provide a friendly, clear response with:
   - Current status
   - Last scan location and timestamp
   - Estimated delivery date (if available)
   - If user asks for details, use get_shipment_timeline for full timeline

Always be helpful and provide accurate information from the tracking data. If tracking number is not found, politely inform the user.`;
  }

  /**
   * Handle tracking request
   */
  async handleTracking(trackingNumber: string): Promise<string> {
    const result = await this.trackShipmentTool.execute({ trackingNumber });

    if (!result.found) {
      return `I couldn't find a shipment with tracking number ${trackingNumber}. Please double-check the tracking number and try again.`;
    }

    let response = `Here's the status of your shipment ${result.trackingNumber}:\n\n`;
    response += `**Current Status:** ${result.status}\n`;
    
    if (result.lastScanLocation) {
      response += `**Last Scan Location:** ${result.lastScanLocation}\n`;
    }
    
    if (result.lastScanAt) {
      const scanDate = new Date(result.lastScanAt);
      response += `**Last Scan Time:** ${scanDate.toLocaleString()}\n`;
    }
    
    if (result.eta) {
      const etaDate = new Date(result.eta);
      response += `**Estimated Delivery:** ${etaDate.toLocaleDateString()}\n`;
    }

    return response;
  }

  /**
   * Handle timeline request
   */
  async handleTimeline(trackingNumber: string): Promise<string> {
    const result = await this.getShipmentTimelineTool.execute({ trackingNumber });

    if (!result.found) {
      return `I couldn't find a shipment with tracking number ${trackingNumber}.`;
    }

    if (!result.timeline || result.timeline.length === 0) {
      return `No timeline events found for shipment ${trackingNumber}.`;
    }

    let response = `Here's the complete timeline for shipment ${trackingNumber}:\n\n`;

    result.timeline.forEach((event, index) => {
      const date = new Date(event.timestamp);
      response += `${index + 1}. **${event.type}** - ${date.toLocaleString()}\n`;
      
      if (event.data.scanType) {
        response += `   Scan: ${event.data.scanType} at ${event.data.location || 'Unknown location'}\n`;
      }
      if (event.data.status) {
        response += `   Status: ${event.data.status}\n`;
      }
      if (event.data.description) {
        response += `   ${event.data.description}\n`;
      }
    });

    return response;
  }
}
