import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EscalationsService } from '../escalations/escalations.service';
import { ShipmentStatus, ServiceLevel } from '@prisma/client';

@Injectable()
export class SlaRiskScannerService {
  private readonly logger = new Logger(SlaRiskScannerService.name);

  constructor(
    private prisma: PrismaService,
    private escalationsService: EscalationsService,
  ) {}

  /**
   * Calculate SLA risk score (0-1)
   * Reused logic from ShipmentsService
   */
  private calculateSlaRiskScore(
    shipment: {
      promisedDeliveryDate: Date | null;
      serviceLevel: ServiceLevel;
      isVip: boolean;
      currentStatus: ShipmentStatus;
      lastScanAt: Date | null;
    },
  ): number {
    // If delivered, no risk
    if (shipment.currentStatus === ShipmentStatus.delivered) {
      return 0.0;
    }

    // If no promised delivery date, calculate based on status and age
    if (!shipment.promisedDeliveryDate) {
      let baseRisk = 0.1;
      if (shipment.currentStatus === ShipmentStatus.in_transit) {
        baseRisk = 0.2;
      }
      if (shipment.isVip) {
        baseRisk += 0.1;
      }
      if (shipment.serviceLevel === ServiceLevel.same_day) {
        baseRisk += 0.1;
      }
      return Math.min(baseRisk, 1.0);
    }

    const now = new Date();
    const promisedDate = new Date(shipment.promisedDeliveryDate);
    const timeUntilDelivery = promisedDate.getTime() - now.getTime();
    const hoursUntilDelivery = timeUntilDelivery / (1000 * 60 * 60);

    let riskScore = 0.0;

    // If already past promised date, high risk
    if (timeUntilDelivery < 0) {
      const hoursOverdue = Math.abs(hoursUntilDelivery);
      if (hoursOverdue < 24) {
        riskScore = 0.7;
      } else if (hoursOverdue < 48) {
        riskScore = 0.85;
      } else {
        riskScore = 0.95;
      }
    } else {
      // Risk increases as we approach the deadline
      if (hoursUntilDelivery < 12) {
        riskScore = 0.6;
      } else if (hoursUntilDelivery < 24) {
        riskScore = 0.4;
      } else if (hoursUntilDelivery < 48) {
        riskScore = 0.25;
      } else {
        riskScore = 0.1;
      }
    }

    // Adjust based on status
    if (shipment.currentStatus === ShipmentStatus.in_transit) {
      if (hoursUntilDelivery < 24) {
        riskScore += 0.15;
      }
    } else if (shipment.currentStatus === ShipmentStatus.PENDING) {
      if (hoursUntilDelivery < 24) {
        riskScore += 0.2;
      }
    }

    // Adjust for service level
    if (shipment.serviceLevel === ServiceLevel.same_day) {
      riskScore += 0.15;
    } else if (shipment.serviceLevel === ServiceLevel.express) {
      riskScore += 0.1;
    }

    // Adjust for VIP
    if (shipment.isVip) {
      riskScore += 0.2;
    }

    // Cap at 1.0
    return Math.min(riskScore, 1.0);
  }

  /**
   * Scheduled job runs every 15 minutes
   * Scans all active shipments and updates SLA risk scores
   */
  @Cron('*/15 * * * *') // Every 15 minutes
  async scanSlaRisks() {
    this.logger.log('Starting SLA risk scan job...');

    try {
      // Get all active shipments (not delivered, not failed, not returned)
      const activeShipments = await this.prisma.shipment.findMany({
        where: {
          currentStatus: {
            notIn: [ShipmentStatus.delivered, ShipmentStatus.failed, ShipmentStatus.returned],
          },
        },
        select: {
          id: true,
          trackingNumber: true,
          promisedDeliveryDate: true,
          serviceLevel: true,
          isVip: true,
          currentStatus: true,
          lastScanAt: true,
          slaRiskScore: true,
        },
      });

      this.logger.log(`Scanning ${activeShipments.length} active shipments for SLA risk`);

      let updatedCount = 0;
      let escalatedCount = 0;
      const escalationThreshold = 0.7;

      for (const shipment of activeShipments) {
        const newRiskScore = this.calculateSlaRiskScore({
          promisedDeliveryDate: shipment.promisedDeliveryDate,
          serviceLevel: shipment.serviceLevel,
          isVip: shipment.isVip,
          currentStatus: shipment.currentStatus,
          lastScanAt: shipment.lastScanAt,
        });

        // Only update if risk score changed significantly (avoid unnecessary DB writes)
        const riskChanged = Math.abs(newRiskScore - shipment.slaRiskScore) > 0.05;

        if (riskChanged) {
          await this.prisma.shipment.update({
            where: { id: shipment.id },
            data: { slaRiskScore: newRiskScore },
          });
          updatedCount++;

          // Trigger escalation if risk score > threshold
          if (newRiskScore > escalationThreshold) {
            // Check if escalation already exists for this shipment
            const existingEscalation = await this.prisma.escalationLog.findFirst({
              where: {
                shipmentId: shipment.id,
                ackReceived: false,
              },
              orderBy: {
                createdAt: 'desc',
              },
            });

            // Only trigger if no active escalation exists
            if (!existingEscalation) {
              try {
                const shouldTrigger = await this.escalationsService.shouldTriggerEscalation(
                  shipment.id,
                );

                if (shouldTrigger.shouldTrigger) {
                  // Get system admin user ID for automated escalation
                  const adminUser = await this.prisma.user.findFirst({
                    where: { role: 'admin' },
                    select: { id: true },
                  });

                  await this.escalationsService.triggerEscalation(
                    {
                      shipmentId: shipment.id,
                      reason: `SLA risk score ${newRiskScore.toFixed(2)} exceeds threshold ${escalationThreshold}`,
                    },
                    adminUser?.id || 'system',
                  );
                  escalatedCount++;
                  this.logger.warn(
                    `Escalation triggered for shipment ${shipment.trackingNumber} (risk: ${newRiskScore.toFixed(2)})`,
                  );
                }
              } catch (error) {
                this.logger.error(
                  `Failed to trigger escalation for shipment ${shipment.id}: ${error.message}`,
                );
              }
            }
          }
        }
      }

      this.logger.log(
        `SLA risk scan completed: ${updatedCount} shipments updated, ${escalatedCount} escalations triggered`,
      );
    } catch (error) {
      this.logger.error(`SLA risk scan job failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Manual trigger for testing/debugging
   */
  async runScan() {
    await this.scanSlaRisks();
  }
}
