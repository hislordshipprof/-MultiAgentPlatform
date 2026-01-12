import { IsOptional, IsEnum, IsUUID, IsString, IsDateString } from 'class-validator';
import { RouteStatus } from '@prisma/client';

export class UpdateRouteDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsEnum(RouteStatus)
  status?: RouteStatus;
}
