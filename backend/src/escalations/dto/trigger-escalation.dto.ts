import { IsUUID, IsOptional, IsString, IsEnum } from 'class-validator';
import { EscalationStatus } from '@prisma/client';

export class TriggerEscalationDto {
  @IsUUID()
  shipmentId: string;

  @IsOptional()
  @IsUUID()
  deliveryIssueId?: string;

  @IsOptional()
  @IsString()
  reason?: string; // Manual trigger reason or automatic trigger reason
}
