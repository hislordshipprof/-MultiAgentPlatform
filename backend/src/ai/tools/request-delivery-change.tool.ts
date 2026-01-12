import { Injectable } from '@nestjs/common';
import { ShipmentsService } from '../../shipments/shipments.service';
import { DeliveryChangesService } from '../../delivery-changes/delivery-changes.service';
import { DeliveryChangeType } from '@prisma/client';

export interface RequestDeliveryChangeInput {
  trackingNumber: string;
  changeType: 'reschedule' | 'update_instructions' | 'change_address';
  newValue: string;
  newDate?: string; // ISO date string for reschedule
  userId: string; // Added: User ID from AI context
}

export interface RequestDeliveryChangeOutput {
  success: boolean;
  trackingNumber?: string;
  changeType?: string;
  status?: string;
  message?: string;
  requestId?: string;
  error?: string;
}

@Injectable()
export class RequestDeliveryChangeTool {
  constructor(
    private shipmentsService: ShipmentsService,
    private deliveryChangesService: DeliveryChangesService,
  ) {}

  async execute(input: RequestDeliveryChangeInput): Promise<RequestDeliveryChangeOutput> {
    try {
      // Find shipment
      const shipment = await this.shipmentsService.findByTracking(input.trackingNumber);

      if (!shipment) {
        return {
          success: false,
          error: `Shipment with tracking number ${input.trackingNumber} not found`,
        };
      }

      // Check if shipment can be changed (not delivered, not returned)
      if (shipment.currentStatus === 'delivered' || shipment.currentStatus === 'returned') {
        return {
          success: false,
          error: `Cannot change delivery for shipment with status: ${shipment.currentStatus}`,
        };
      }

      // Create the delivery change request via service
      const changeRequest = await this.deliveryChangesService.create(
        {
          shipmentId: shipment.id,
          changeType: input.changeType as DeliveryChangeType,
          newValue: input.newValue,
          newDate: input.newDate,
        },
        input.userId,
        'customer', // Default role for customer requests
      );

      // Generate user-friendly message
      let message = '';
      switch (input.changeType) {
        case 'reschedule':
          message = `Delivery reschedule requested for ${input.trackingNumber}. New date: ${input.newDate || input.newValue}. Your request has been submitted and will be reviewed by our operations team. Request ID: ${changeRequest.id.substring(0, 8)}.`;
          break;
        case 'update_instructions':
          message = `Delivery instructions update requested for ${input.trackingNumber}. New instructions: ${input.newValue}. Your request has been submitted. Request ID: ${changeRequest.id.substring(0, 8)}.`;
          break;
        case 'change_address':
          message = `Address change requested for ${input.trackingNumber}. New address: ${input.newValue}. This request requires approval and will be reviewed by our operations team. Request ID: ${changeRequest.id.substring(0, 8)}.`;
          break;
      }

      return {
        success: true,
        trackingNumber: shipment.trackingNumber,
        changeType: input.changeType,
        status: changeRequest.status,
        requestId: changeRequest.id,
        message,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error processing delivery change: ${error.message}`,
      };
    }
  }

  getDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: 'request_delivery_change',
        description:
          'Request a change to a delivery (reschedule, update instructions, or change address). Validates the request based on shipment status and policies.',
        parameters: {
          type: 'object',
          properties: {
            trackingNumber: {
              type: 'string',
              description: 'The tracking number of the shipment',
            },
            changeType: {
              type: 'string',
              enum: ['reschedule', 'update_instructions', 'change_address'],
              description:
                'Type of change: reschedule delivery window, update delivery instructions, or change delivery address',
            },
            newValue: {
              type: 'string',
              description:
                'The new value for the change. For reschedule: ISO date string. For update_instructions: new instructions text. For change_address: new address.',
            },
            newDate: {
              type: 'string',
              description: 'Optional ISO date string for rescheduling (can be included in newValue instead)',
            },
          },
          required: ['trackingNumber', 'changeType', 'newValue'],
        },
      },
    };
  }
}
