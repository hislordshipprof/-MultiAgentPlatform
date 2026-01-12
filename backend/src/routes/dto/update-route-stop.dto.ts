import { IsOptional, IsInt, IsDateString, IsString, Min } from 'class-validator';

export class UpdateRouteStopDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  sequenceNumber?: number;

  @IsOptional()
  @IsDateString()
  plannedEta?: string;

  @IsOptional()
  @IsDateString()
  actualArrival?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
