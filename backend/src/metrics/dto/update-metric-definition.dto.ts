import { IsOptional, IsString, IsEnum, IsNumber, IsBoolean, MinLength } from 'class-validator';
import { AggregationType, MetricDimension, Role } from '@prisma/client';

export class UpdateMetricDefinitionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(AggregationType)
  aggregationType?: AggregationType;

  @IsOptional()
  @IsEnum(MetricDimension)
  dimension?: MetricDimension;

  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @IsOptional()
  @IsNumber()
  warningThreshold?: number;

  @IsOptional()
  @IsNumber()
  criticalThreshold?: number;

  @IsOptional()
  @IsEnum(Role)
  ownerRole?: Role;

  @IsOptional()
  @IsBoolean()
  isVisibleOnDashboard?: boolean;
}
