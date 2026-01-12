import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { DeliveryChangeStatus, DeliveryChangeType } from '@prisma/client';

export class FilterDeliveryChangesDto {
  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @IsOptional()
  @IsEnum(DeliveryChangeStatus)
  status?: DeliveryChangeStatus;

  @IsOptional()
  @IsEnum(DeliveryChangeType)
  changeType?: DeliveryChangeType;
}
