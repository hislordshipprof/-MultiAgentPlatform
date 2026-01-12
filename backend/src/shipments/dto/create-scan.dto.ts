import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ScanType } from '@prisma/client';

export class CreateScanDto {
  @IsEnum(ScanType)
  scanType: ScanType;

  @IsString()
  location: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
