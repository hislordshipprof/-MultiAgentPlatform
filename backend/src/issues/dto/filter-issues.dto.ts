import { IsOptional, IsEnum, IsString, IsUUID, IsIn } from 'class-validator';
import { IssueType, IssueStatus } from '@prisma/client';

export class FilterIssuesDto {
  @IsOptional()
  @IsString()
  @IsIn(['critical', 'high', 'medium', 'low', 'all'])
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'all'; // Based on aiSeverityScore ranges, 'all' means no filter

  @IsOptional()
  @IsString()
  @IsIn([IssueStatus.open, IssueStatus.investigating, IssueStatus.resolved, IssueStatus.closed, 'all'])
  status?: IssueStatus | 'all'; // 'all' means no filter

  @IsOptional()
  @IsEnum(IssueType)
  issueType?: IssueType;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;
}
