import { Module } from '@nestjs/common';
import { AgentSessionsService } from './agent-sessions.service';
import { AgentSessionsController } from './agent-sessions.controller';

@Module({
  controllers: [AgentSessionsController],
  providers: [AgentSessionsService],
  exports: [AgentSessionsService],
})
export class AgentSessionsModule {}
