import { IsUUID, IsInt, IsDateString, IsOptional, IsString, Min } from 'class-validator';

export class CreateRouteStopDto {
  @IsUUID()
  shipmentId: string;

  @IsInt()
  @Min(1)
  sequenceNumber: number;

  @IsOptional()
  @IsDateString()
  plannedEta?: string;
}
