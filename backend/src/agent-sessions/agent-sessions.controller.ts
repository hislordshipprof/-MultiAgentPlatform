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
import { AgentSessionsService } from './agent-sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, AgentChannel, AgentSessionStatus } from '@prisma/client';

@Controller('agent-sessions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AgentSessionsController {
  constructor(private readonly agentSessionsService: AgentSessionsService) {}

  @Post()
  @Roles(Role.customer, Role.driver, Role.dispatcher, Role.manager, Role.admin)
  create(@Body() createDto: CreateSessionDto, @Request() req: any) {
    return this.agentSessionsService.create(createDto, req.user?.id || null, req.user?.role || null);
  }

  @Get()
  @Roles(Role.customer, Role.driver, Role.dispatcher, Role.manager, Role.admin)
  findAll(
    @Request() req: any,
    @Query('userId') userId?: string,
    @Query('channel') channel?: AgentChannel,
    @Query('status') status?: AgentSessionStatus,
  ) {
    return this.agentSessionsService.findAll(
      { userId, channel, status },
      req.user?.id || null,
      req.user?.role || null,
    );
  }

  @Get(':id')
  @Roles(Role.customer, Role.driver, Role.dispatcher, Role.manager, Role.admin)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.agentSessionsService.findOne(id, req.user?.id || null, req.user?.role || null);
  }

  @Patch(':id')
  @Roles(Role.customer, Role.driver, Role.dispatcher, Role.manager, Role.admin)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateSessionDto,
    @Request() req: any,
  ) {
    return this.agentSessionsService.update(id, updateDto, req.user?.id || null, req.user?.role || null);
  }

  @Post(':id/end')
  @Roles(Role.customer, Role.driver, Role.dispatcher, Role.manager, Role.admin)
  endSession(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.agentSessionsService.endSession(id, req.user?.id || null, req.user?.role || null);
  }

  @Post(':id/transcript')
  @Roles(Role.customer, Role.driver, Role.dispatcher, Role.manager, Role.admin)
  appendToTranscript(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { role: 'user' | 'assistant'; content: string; timestamp?: string },
    @Request() req: any,
  ) {
    return this.agentSessionsService.appendToTranscript(
      id,
      {
        role: body.role,
        content: body.content,
        timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
      },
      req.user?.id || null,
      req.user?.role || null,
    );
  }

  @Post(':id/outcome')
  @Roles(Role.customer, Role.driver, Role.dispatcher, Role.manager, Role.admin)
  updateOutcome(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { action?: string; data?: any },
    @Request() req: any,
  ) {
    return this.agentSessionsService.updateOutcome(
      id,
      { action: body.action, data: body.data },
      req.user?.id || null,
      req.user?.role || null,
    );
  }
}
