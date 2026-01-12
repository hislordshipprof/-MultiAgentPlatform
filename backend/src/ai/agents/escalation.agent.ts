import { Injectable, Logger } from '@nestjs/common';
import { EscalationsService } from '../../escalations/escalations.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LogisticsEscalationAgent {
  private readonly logger = new Logger(LogisticsEscalationAgent.name);

  constructor(
    private escalationsService: EscalationsService,
    private prisma: PrismaService,
  ) {}

  /**
   * System prompt for the escalation agent
   */
  getSystemPrompt(): string {
    return `You are the LogisticsEscalationAgent, responsible for monitoring and triggering escalations for critical shipments.

Your responsibilities:
- Monitor shipments with high severity issues (aiSeverityScore > 0.8)
- Monitor VIP shipments with issues
- Monitor shipments with high SLA risk (slaRiskScore > 0.7)
- Trigger escalations automatically when thresholds are exceeded
- Advance escalation ladder until acknowledgment is recorded

You run as a background agent and should be triggered:
- When a new high-severity issue is created
- When SLA risk score exceeds threshold (via background job)
- When escalation ladder timeout expires (via background job)

Always prioritize critical situations and ensure proper escalation workflow.`;
  }

  /**
   * Check and trigger escalations for high-risk shipments
   * Called by background jobs or when issues are created
   */
  async checkAndTriggerEscalations(shipmentId: string): Promise<void> {
    try {
      const shouldTrigger = await this.escalationsService.shouldTriggerEscalation(shipmentId);

      if (shouldTrigger.shouldTrigger) {
        // Get system admin user for automated escalations
        const adminUser = await this.prisma.user.findFirst({
          where: { role: 'admin' },
          select: { id: true },
        });

        await this.escalationsService.triggerEscalation(
          {
            shipmentId,
            reason: `Automated escalation triggered: ${shouldTrigger.reason}`,
          },
          adminUser?.id || 'system',
        );

        this.logger.log(`Escalation triggered for shipment ${shipmentId}: ${shouldTrigger.reason}`);
      }
    } catch (error) {
      this.logger.error(`Failed to trigger escalation for shipment ${shipmentId}: ${error.message}`);
    }
  }

  /**
   * Advance escalation ladder if timeout expired
   * Called by background job
   */
  async advanceEscalationLadder(): Promise<void> {
    try {
      // Get active escalations that need advancement
      const activeEscalations = await this.prisma.escalationLog.findMany({
        where: {
          ackReceived: false,
        },
        include: {
          contact: true,
          shipment: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const now = new Date();

      for (const escalation of activeEscalations) {
        // Check if timeout has expired
        const elapsedSeconds = (now.getTime() - escalation.createdAt.getTime()) / 1000;
        
        if (elapsedSeconds >= (escalation.contact.timeoutSeconds || 3600)) {
          // Get system admin user for automated advancement
          const adminUser = await this.prisma.user.findFirst({
            where: { role: 'admin' },
            select: { id: true },
          });

          await this.escalationsService.advanceEscalation(
            escalation.shipmentId,
            {
              reason: `Timeout expired for contact at position ${escalation.contact.position}`,
            },
            adminUser?.id || 'system',
          );

          this.logger.log(
            `Escalation advanced for shipment ${escalation.shipmentId} after timeout`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to advance escalation ladder: ${error.message}`);
    }
  }
}
