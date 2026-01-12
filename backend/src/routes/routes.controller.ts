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
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { CreateRouteStopDto } from './dto/create-route-stop.dto';
import { UpdateRouteStopDto } from './dto/update-route-stop.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('routes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  create(@Body() createRouteDto: CreateRouteDto, @Request() req: any) {
    return this.routesService.create(createRouteDto, req.user.id, req.user.role);
  }

  @Get()
  @Roles(Role.dispatcher, Role.manager, Role.admin, Role.driver)
  findAll(@Request() req: any, @Query('date') date?: string, @Query('driverId') driverId?: string, @Query('region') region?: string) {
    return this.routesService.findAll({ date, driverId, region }, req.user.id, req.user.role);
  }

  @Get('driver/:driverId')
  @Roles(Role.driver, Role.manager, Role.admin)
  getDriverRoutes(@Param('driverId', ParseUUIDPipe) driverId: string, @Request() req: any) {
    return this.routesService.getDriverRoutes(driverId, req.user.id, req.user.role);
  }

  @Get(':id')
  @Roles(Role.dispatcher, Role.manager, Role.admin, Role.driver)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.routesService.findOne(id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateRouteDto: UpdateRouteDto, @Request() req: any) {
    return this.routesService.update(id, updateRouteDto, req.user.id, req.user.role);
  }

  @Get(':id/stops')
  @Roles(Role.dispatcher, Role.manager, Role.admin, Role.driver)
  getRouteStops(@Param('id', ParseUUIDPipe) routeId: string, @Request() req: any) {
    return this.routesService.getRouteStops(routeId, req.user.id, req.user.role);
  }

  @Post(':id/stops')
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  createRouteStop(
    @Param('id', ParseUUIDPipe) routeId: string,
    @Body() createStopDto: CreateRouteStopDto,
    @Request() req: any,
  ) {
    return this.routesService.createRouteStop(routeId, createStopDto, req.user.id, req.user.role);
  }

  @Patch(':id/stops/:stopId')
  @Roles(Role.driver, Role.dispatcher, Role.manager, Role.admin)
  updateRouteStop(
    @Param('id', ParseUUIDPipe) routeId: string,
    @Param('stopId', ParseUUIDPipe) stopId: string,
    @Body() updateStopDto: UpdateRouteStopDto,
    @Request() req: any,
  ) {
    return this.routesService.updateRouteStop(routeId, stopId, updateStopDto, req.user.id, req.user.role);
  }
}
