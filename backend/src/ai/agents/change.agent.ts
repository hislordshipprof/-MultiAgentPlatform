import { Injectable } from '@nestjs/common';
import { TrackShipmentTool } from '../tools/track-shipment.tool';
import { RequestDeliveryChangeTool } from '../tools/request-delivery-change.tool';

@Injectable()
export class DeliveryChangeAgent {
  constructor(
    private trackShipmentTool: TrackShipmentTool,
    private requestDeliveryChangeTool: RequestDeliveryChangeTool,
  ) {}

  /**
   * System prompt for the change agent
   */
  getSystemPrompt(): string {
    return `You are the DeliveryChangeAgent, specialized in helping customers request delivery changes.

Your capabilities:
- Track shipments to verify they exist using track_shipment tool
- Request delivery changes using request_delivery_change tool

Supported change types:
1. **reschedule**: Change the delivery date/time window
2. **update_instructions**: Update delivery instructions (e.g., leave at door, call on arrival)
3. **change_address**: Change the delivery address (requires approval)

When a user requests a change:
1. Extract tracking number from their message
2. Verify shipment exists and can be changed (not delivered, not returned)
3. Determine change type from their request
4. Extract the new value (date for reschedule, instructions text, or new address)
5. Use request_delivery_change tool to process the request

Important:
- Address changes require approval and may not be allowed for all shipments
- Rescheduling must be within policy limits
- Validate that the shipment is still changeable

Always confirm the change request clearly before processing.`;
  }

  /**
   * Determine change type from user message
   */
  determineChangeType(message: string): 'reschedule' | 'update_instructions' | 'change_address' {
    const lowerMsg = message.toLowerCase();

    if (
      lowerMsg.includes('reschedule') ||
      lowerMsg.includes('different time') ||
      lowerMsg.includes('different date') ||
      lowerMsg.includes('later') ||
      lowerMsg.includes('earlier') ||
      lowerMsg.includes('tomorrow') ||
      lowerMsg.includes('next week')
    ) {
      return 'reschedule';
    }

    if (
      lowerMsg.includes('address') ||
      lowerMsg.includes('location') ||
      lowerMsg.includes('different address')
    ) {
      return 'change_address';
    }

    return 'update_instructions';
  }

}
