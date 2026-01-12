import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DeliveryChangeStatus } from '@prisma/client';

export class UpdateDeliveryChangeDto {
  @IsOptional()
  @IsEnum(DeliveryChangeStatus)
  status?: DeliveryChangeStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
