import { IsString, IsOptional } from 'class-validator';

export class AcknowledgeEscalationDto {
  @IsString()
  method: string; // e.g., "email", "phone", "slack", "dashboard"

  @IsOptional()
  @IsString()
  notes?: string;
}
