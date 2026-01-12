import { IsOptional, IsEnum, IsString } from 'class-validator';
import { IssueStatus } from '@prisma/client';

export class UpdateIssueDto {
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
