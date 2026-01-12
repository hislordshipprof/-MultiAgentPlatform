import { IsUUID, IsString, IsEnum, IsInt, Min, IsOptional, IsBoolean } from 'class-validator';
import { ContactType } from '@prisma/client';

export class CreateEscalationContactDto {
  @IsUUID()
  userId: string;

  @IsString()
  position: string; // e.g., "Shift Manager", "Operations Lead"

  @IsEnum(ContactType)
  contactType: ContactType;

  @IsInt()
  @Min(1)
  timeoutSeconds: number; // Seconds to wait before advancing to next contact

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
