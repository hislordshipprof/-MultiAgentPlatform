import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EscalationsService } from './escalations.service';
import { TriggerEscalationDto } from './dto/trigger-escalation.dto';
import { AdvanceEscalationDto } from './dto/advance-escalation.dto';
import { AcknowledgeEscalationDto } from './dto/acknowledge-escalation.dto';
import { CreateEscalationContactDto } from './dto/create-escalation-contact.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('escalations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class EscalationsController {
  constructor(private readonly escalationsService: EscalationsService) {}

  @Post('trigger')
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  triggerEscalation(@Body() triggerDto: TriggerEscalationDto, @Request() req: any) {
    return this.escalationsService.triggerEscalation(triggerDto, req.user.userId);
  }

  @Post(':shipmentId/advance')
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  advanceEscalation(
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() advanceDto: AdvanceEscalationDto,
    @Request() req: any,
  ) {
    return this.escalationsService.advanceEscalation(shipmentId, advanceDto, req.user.userId);
  }

  @Post(':shipmentId/acknowledge')
  @Roles(Role.manager, Role.admin)
  acknowledgeEscalation(
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() acknowledgeDto: AcknowledgeEscalationDto,
    @Request() req: any,
  ) {
    return this.escalationsService.acknowledgeEscalation(shipmentId, acknowledgeDto, req.user.userId);
  }

  @Get()
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  findAll(
    @Query('shipmentId') shipmentId?: string,
    @Query('deliveryIssueId') deliveryIssueId?: string,
    @Query('status') status?: 'active' | 'acknowledged' | 'resolved',
    @Request() req?: any,
  ) {
    return this.escalationsService.findAll(
      {
        shipmentId,
        deliveryIssueId,
        status,
      },
      req.user.userId,
      req.user.role,
    );
  }

  // Move 'contacts' route before ':shipmentId' to avoid route conflicts
  @Get('contacts')
  @Roles(Role.admin)
  findAllEscalationContacts() {
    return this.escalationsService.findAllEscalationContacts();
  }

  @Get(':shipmentId')
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  findOne(@Param('shipmentId', ParseUUIDPipe) shipmentId: string, @Request() req: any) {
    return this.escalationsService.findOne(shipmentId, req.user.userId, req.user.role);
  }

  @Post('contacts')
  @Roles(Role.admin)
  createEscalationContact(@Body() createDto: CreateEscalationContactDto) {
    return this.escalationsService.createEscalationContact(createDto);
  }
}
