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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DeliveryChangesService } from './delivery-changes.service';
import { CreateDeliveryChangeDto } from './dto/create-delivery-change.dto';
import { UpdateDeliveryChangeDto } from './dto/update-delivery-change.dto';
import { FilterDeliveryChangesDto } from './dto/filter-delivery-changes.dto';

@Controller('delivery-changes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DeliveryChangesController {
  constructor(private readonly deliveryChangesService: DeliveryChangesService) {}

  @Post()
  @Roles('customer', 'admin', 'manager', 'dispatcher')
  async create(@Body() createDto: CreateDeliveryChangeDto, @Request() req: any) {
    return this.deliveryChangesService.create(createDto, req.user.userId, req.user.role);
  }

  @Get()
  @Roles('customer', 'admin', 'manager', 'dispatcher')
  async findAll(@Query() filters: FilterDeliveryChangesDto, @Request() req: any) {
    return this.deliveryChangesService.findAll(filters, req.user.role, req.user.userId);
  }

  @Get(':id')
  @Roles('customer', 'admin', 'manager', 'dispatcher')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.deliveryChangesService.findOne(id, req.user.role, req.user.userId);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateDeliveryChangeDto,
    @Request() req: any,
  ) {
    return this.deliveryChangesService.update(id, updateDto, req.user.userId, req.user.role);
  }
}
