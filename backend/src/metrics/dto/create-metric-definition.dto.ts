import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { AggregationType, MetricDimension, Role } from '@prisma/client';

export class CreateMetricDefinitionDto {
  @IsString()
  @MinLength(1)
  key: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(AggregationType)
  aggregationType: AggregationType;

  @IsEnum(MetricDimension)
  dimension: MetricDimension;

  @IsNumber()
  targetValue: number;

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
