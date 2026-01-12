import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateScanDto } from './dto/create-scan.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.admin, Role.manager, Role.dispatcher)
  create(@Body() createShipmentDto: any) {
    // In real app, DTO validation
    return this.shipmentsService.create(createShipmentDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.admin, Role.manager, Role.dispatcher, Role.driver, Role.customer)
  findAll(@Request() req: any) {
    const userId = req.user.userId;
    const userRole = req.user.role;
    return this.shipmentsService.findAll(userId, userRole);
  }

  @Get('track/:trackingNumber')
  async trackByTrackingNumber(@Param('trackingNumber') trackingNumber: string) {
    // Public endpoint - no auth required
    return this.shipmentsService.findByTracking(trackingNumber);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.admin, Role.manager, Role.dispatcher, Role.driver, Role.customer)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const userId = req.user.userId;
    const userRole = req.user.role;
    return this.shipmentsService.findOne(id, userId, userRole);
  }

  @Get(':id/timeline')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.admin, Role.manager, Role.dispatcher, Role.driver, Role.customer)
  getTimeline(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const userId = req.user.userId;
    const userRole = req.user.role;
    return this.shipmentsService.getTimeline(id, userId, userRole);
  }

  @Post(':id/scans')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.admin, Role.manager, Role.dispatcher, Role.driver)
  createScan(@Param('id', ParseUUIDPipe) id: string, @Body() createScanDto: CreateScanDto) {
    return this.shipmentsService.createScan(id, createScanDto);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.admin, Role.manager, Role.dispatcher, Role.driver)
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() updateStatusDto: UpdateStatusDto) {
    return this.shipmentsService.updateStatus(id, updateStatusDto);
  }
}
