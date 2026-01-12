import { IsEnum, IsOptional, IsUUID, IsString } from 'class-validator';
import { AgentChannel } from '@prisma/client';

export class CreateSessionDto {
  @IsEnum(AgentChannel)
  channel: AgentChannel;

  @IsOptional()
  @IsUUID()
  linkedShipmentId?: string;

  @IsOptional()
  @IsString()
  openAiSessionId?: string;
}
