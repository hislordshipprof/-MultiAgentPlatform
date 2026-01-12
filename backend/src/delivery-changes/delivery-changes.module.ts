import { Module } from '@nestjs/common';
import { DeliveryChangesController } from './delivery-changes.controller';
import { DeliveryChangesService } from './delivery-changes.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [DeliveryChangesController],
  providers: [DeliveryChangesService],
  exports: [DeliveryChangesService],
})
export class DeliveryChangesModule {}
