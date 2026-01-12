import { IsOptional, IsString, IsUUID, IsObject } from 'class-validator';

export class UpdateSessionDto {
  @IsOptional()
  @IsUUID()
  linkedShipmentId?: string;

  @IsOptional()
  @IsString()
  openAiSessionId?: string;

  @IsOptional()
  @IsString()
  lastAgentName?: string;

  @IsOptional()
  @IsObject()
  transcript?: any; // JSON array or object

  @IsOptional()
  @IsObject()
  outcome?: any; // JSON object with action results
}
