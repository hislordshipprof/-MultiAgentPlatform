import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { FilterIssuesDto } from './dto/filter-issues.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('issues')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  @Roles(Role.customer, Role.dispatcher, Role.manager, Role.admin)
  create(@Body() createIssueDto: CreateIssueDto, @Request() req: any) {
    return this.issuesService.create(createIssueDto, req.user.userId, req.user.role);
  }

  @Get()
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  findAll(@Query() filters: FilterIssuesDto, @Request() req: any) {
    return this.issuesService.findAll(filters, req.user.userId, req.user.role);
  }

  @Get('shipment/:shipmentId')
  @Roles(Role.customer, Role.dispatcher, Role.manager, Role.admin)
  findByShipment(@Param('shipmentId', ParseUUIDPipe) shipmentId: string, @Request() req: any) {
    return this.issuesService.findByShipment(shipmentId, req.user.userId, req.user.role);
  }

  @Get(':id')
  @Roles(Role.customer, Role.dispatcher, Role.manager, Role.admin)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.issuesService.findOne(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateIssueDto: UpdateIssueDto, @Request() req: any) {
    return this.issuesService.update(id, updateIssueDto, req.user.userId, req.user.role);
  }
}
