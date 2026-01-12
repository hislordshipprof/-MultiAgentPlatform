import { IsUUID, IsString, IsEnum, MinLength } from 'class-validator';
import { IssueType } from '@prisma/client';

export class CreateIssueDto {
  @IsUUID()
  shipmentId: string;

  @IsEnum(IssueType)
  issueType: IssueType;

  @IsString()
  @MinLength(10)
  description: string;
}
