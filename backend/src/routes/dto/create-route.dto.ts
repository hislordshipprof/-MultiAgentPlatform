import { IsString, IsDateString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { RouteStatus } from '@prisma/client';

export class CreateRouteDto {
  @IsString()
  routeCode: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsString()
  region: string;

  @IsOptional()
  @IsEnum(RouteStatus)
  status?: RouteStatus;
}
