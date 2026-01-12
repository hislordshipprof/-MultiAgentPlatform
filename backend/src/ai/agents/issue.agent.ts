import { Injectable } from '@nestjs/common';
import { TrackShipmentTool } from '../tools/track-shipment.tool';
import { CreateIssueTool } from '../tools/create-issue.tool';

@Injectable()
export class DeliveryIssueAgent {
  constructor(
    private trackShipmentTool: TrackShipmentTool,
    private createIssueTool: CreateIssueTool,
  ) {}

  /**
   * System prompt for the issue agent
   */
  getSystemPrompt(): string {
    return `You are the DeliveryIssueAgent, specialized in helping customers report delivery issues.

Your capabilities:
- Track shipments to verify they exist using track_shipment tool
- Create delivery issues using create_delivery_issue tool

When a user reports an issue:
1. Extract tracking number from their message
2. Verify shipment exists using track_shipment
3. Classify the issue type from their description:
   - damaged: Package is damaged or items are broken
   - missing: Package or items are missing
   - wrong_address: Package delivered to wrong address
   - missed_delivery: Customer missed the delivery attempt
   - delay: Delivery is delayed beyond promised date
   - other: Any other issue not covered above

4. Collect sufficient details about the issue
5. Create the issue using create_delivery_issue tool

Always be empathetic and helpful. Collect all necessary information before creating the issue.`;
  }

  /**
   * Classify issue type from description
   */
  classifyIssueType(description: string): string {
    const lowerDesc = description.toLowerCase();

    if (lowerDesc.includes('damaged') || lowerDesc.includes('broken') || lowerDesc.includes('smashed')) {
      return 'damaged';
    }
    if (lowerDesc.includes('missing') || lowerDesc.includes('did not receive') || lowerDesc.includes("didn't get")) {
      return 'missing';
    }
    if (lowerDesc.includes('wrong address') || lowerDesc.includes('wrong location')) {
      return 'wrong_address';
    }
    if (lowerDesc.includes('missed') || lowerDesc.includes('wasn\'t home') || lowerDesc.includes('not available')) {
      return 'missed_delivery';
    }
    if (lowerDesc.includes('delay') || lowerDesc.includes('late') || lowerDesc.includes('overdue')) {
      return 'delay';
    }

    return 'other';
  }

  /**
   * Handle issue creation
   */
  async handleIssueCreation(
    userId: string,
    trackingNumber: string,
    description: string,
    issueType?: string,
  ): Promise<string> {
    // Verify shipment exists
    const trackingResult = await this.trackShipmentTool.execute({ trackingNumber });
    
    if (!trackingResult.found) {
      return `I couldn't find a shipment with tracking number ${trackingNumber}. Please verify the tracking number and try again.`;
    }

    // Classify issue type if not provided
    const classifiedType = issueType || this.classifyIssueType(description);

    // Create the issue
    const result = await this.createIssueTool.execute(userId, {
      trackingNumber,
      issueType: classifiedType,
      description,
    });

    if (!result.success) {
      return `I encountered an error while creating the issue: ${result.error}. Please try again or contact support.`;
    }

    let response = `I've successfully created your delivery issue for shipment ${result.trackingNumber}.\n\n`;
    response += `**Issue Type:** ${result.issueType}\n`;
    response += `**Severity Score:** ${result.severity ? (result.severity * 100).toFixed(0) : 'N/A'}%\n\n`;
    response += `Our operations team has been notified and will investigate this issue. You can track the status of your issue in your dashboard.`;

    return response;
  }
}
