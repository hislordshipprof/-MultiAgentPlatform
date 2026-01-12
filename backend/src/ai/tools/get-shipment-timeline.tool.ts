import { Injectable } from '@nestjs/common';
import { ShipmentsService } from '../../shipments/shipments.service';

export interface GetShipmentTimelineInput {
  trackingNumber: string;
}

export interface TimelineEvent {
  type: string;
  timestamp: string;
  data: any;
}

export interface GetShipmentTimelineOutput {
  found: boolean;
  trackingNumber?: string;
  timeline?: TimelineEvent[];
  error?: string;
}

@Injectable()
export class GetShipmentTimelineTool {
  constructor(private shipmentsService: ShipmentsService) {}

  async execute(input: GetShipmentTimelineInput): Promise<GetShipmentTimelineOutput> {
    try {
      // First find shipment by tracking number
      const shipment = await this.shipmentsService.findByTracking(input.trackingNumber);

      if (!shipment) {
        return {
          found: false,
          error: `Shipment with tracking number ${input.trackingNumber} not found`,
        };
      }

      // Get timeline
      const timelineData = await this.shipmentsService.getTimeline(shipment.id);

      return {
        found: true,
        trackingNumber: shipment.trackingNumber,
        timeline: timelineData.timeline.map((event) => ({
          type: event.type,
          timestamp: event.timestamp.toISOString(),
          data: event.data,
        })),
      };
    } catch (error) {
      return {
        found: false,
        error: `Error getting shipment timeline: ${error.message}`,
      };
    }
  }

  getDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: 'get_shipment_timeline',
        description:
          'Get the complete timeline of events for a shipment, including scans, status changes, and issues. Returns chronological list of all events.',
        parameters: {
          type: 'object',
          properties: {
            trackingNumber: {
              type: 'string',
              description: 'The tracking number of the shipment',
            },
          },
          required: ['trackingNumber'],
        },
      },
    };
  }
}
