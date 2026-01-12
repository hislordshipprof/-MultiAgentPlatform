import { IsEnum } from 'class-validator';
import { ShipmentStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(ShipmentStatus)
  status: ShipmentStatus;
}
