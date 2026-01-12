import { Module } from '@nestjs/common';
import { EscalationsService } from './escalations.service';
import { EscalationsController } from './escalations.controller';
import { AcknowledgmentsService } from './acknowledgments.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [EscalationsController],
  providers: [EscalationsService, AcknowledgmentsService],
  exports: [EscalationsService, AcknowledgmentsService],
})
export class EscalationsModule {}
