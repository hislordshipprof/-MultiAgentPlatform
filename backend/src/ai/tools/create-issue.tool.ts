import { Injectable } from '@nestjs/common';
import { IssuesService } from '../../issues/issues.service';
import { ShipmentsService } from '../../shipments/shipments.service';
import { IssueType } from '@prisma/client';

export interface CreateIssueInput {
  trackingNumber: string;
  issueType: string;
  description: string;
}

export interface CreateIssueOutput {
  success: boolean;
  issueId?: string;
  trackingNumber?: string;
  issueType?: string;
  severity?: number;
  error?: string;
}

@Injectable()
export class CreateIssueTool {
  constructor(
    private issuesService: IssuesService,
    private shipmentsService: ShipmentsService,
  ) {}

  async execute(userId: string, input: CreateIssueInput): Promise<CreateIssueOutput> {
    try {
      // First, find the shipment by tracking number
      const shipment = await this.shipmentsService.findByTracking(input.trackingNumber);

      if (!shipment) {
        return {
          success: false,
          error: `Shipment with tracking number ${input.trackingNumber} not found`,
        };
      }

      // Validate issue type
      const validIssueTypes = Object.values(IssueType);
      if (!validIssueTypes.includes(input.issueType as IssueType)) {
        return {
          success: false,
          error: `Invalid issue type. Must be one of: ${validIssueTypes.join(', ')}`,
        };
      }

      // Create the issue
      const issue = await this.issuesService.create(
        {
          shipmentId: shipment.id,
          issueType: input.issueType as IssueType,
          description: input.description,
        },
        userId,
        'customer', // Default role for customer-reported issues
      );

      return {
        success: true,
        issueId: issue.id,
        trackingNumber: shipment.trackingNumber,
        issueType: issue.issueType,
        severity: issue.aiSeverityScore,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error creating issue: ${error.message}`,
      };
    }
  }

  getDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: 'create_delivery_issue',
        description:
          'Create a delivery issue for a shipment. Collects issue details, classifies the issue type, and creates a DeliveryIssue record. Notifies operations team in real-time.',
        parameters: {
          type: 'object',
          properties: {
            trackingNumber: {
              type: 'string',
              description: 'The tracking number of the shipment',
            },
            issueType: {
              type: 'string',
              enum: ['damaged', 'missing', 'wrong_address', 'missed_delivery', 'delay', 'other'],
              description:
                'The type of issue: damaged, missing, wrong_address, missed_delivery, delay, or other',
            },
            description: {
              type: 'string',
              description: 'Detailed description of the issue',
            },
          },
          required: ['trackingNumber', 'issueType', 'description'],
        },
      },
    };
  }
}
