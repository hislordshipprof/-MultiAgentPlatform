import { IsUUID, IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { DeliveryChangeType } from '@prisma/client';

export class CreateDeliveryChangeDto {
  @IsUUID()
  shipmentId: string;

  @IsEnum(DeliveryChangeType)
  changeType: DeliveryChangeType;

  @IsString()
  newValue: string;

  @IsOptional()
  @IsDateString()
  newDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
