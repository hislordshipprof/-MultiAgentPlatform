import { IsOptional, IsString } from 'class-validator';

export class AdvanceEscalationDto {
  @IsOptional()
  @IsString()
  reason?: string; // Reason for advancing (e.g., "timeout", "no response")
}
