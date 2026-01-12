import { Injectable } from '@nestjs/common';
import { ShipmentsService } from '../../shipments/shipments.service';

export interface TrackShipmentInput {
  trackingNumber: string;
}

export interface TrackShipmentOutput {
  found: boolean;
  trackingNumber?: string;
  status?: string;
  lastScanLocation?: string;
  lastScanAt?: string;
  promisedDeliveryDate?: string;
  currentLocation?: string;
  eta?: string;
  error?: string;
}

@Injectable()
export class TrackShipmentTool {
  constructor(private shipmentsService: ShipmentsService) {}

  async execute(input: TrackShipmentInput): Promise<TrackShipmentOutput> {
    try {
      const shipment = await this.shipmentsService.findByTracking(input.trackingNumber);

      if (!shipment) {
        return {
          found: false,
          error: `Shipment with tracking number ${input.trackingNumber} not found`,
        };
      }

      // Get latest scan
      const latestScan = shipment.scans && shipment.scans.length > 0 ? shipment.scans[0] : null;

      return {
        found: true,
        trackingNumber: shipment.trackingNumber,
        status: shipment.currentStatus,
        lastScanLocation: shipment.lastScanLocation || latestScan?.location || undefined,
        lastScanAt: shipment.lastScanAt
          ? shipment.lastScanAt.toISOString()
          : latestScan?.timestamp
            ? latestScan.timestamp.toISOString()
            : undefined,
        promisedDeliveryDate: shipment.promisedDeliveryDate
          ? shipment.promisedDeliveryDate.toISOString()
          : undefined,
        currentLocation: latestScan?.location || undefined,
        eta: shipment.promisedDeliveryDate ? shipment.promisedDeliveryDate.toISOString() : undefined,
      };
    } catch (error) {
      return {
        found: false,
        error: `Error tracking shipment: ${error.message}`,
      };
    }
  }

  getDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: 'track_shipment',
        description:
          'Track a shipment by its tracking number. Returns current status, last scan location, and delivery information.',
        parameters: {
          type: 'object',
          properties: {
            trackingNumber: {
              type: 'string',
              description: 'The tracking number of the shipment (e.g., TRK-12345-67890)',
            },
          },
          required: ['trackingNumber'],
        },
      },
    };
  }
}
