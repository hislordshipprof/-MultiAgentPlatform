import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { CreateMetricDefinitionDto } from './dto/create-metric-definition.dto';
import { UpdateMetricDefinitionDto } from './dto/update-metric-definition.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('metrics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('overview')
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  getOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const timeRange = {
      start: startDate ? new Date(startDate) : undefined,
      end: endDate ? new Date(endDate) : undefined,
    };
    return this.metricsService.getOverview(timeRange);
  }

  @Get('definitions')
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  findAllDefinitions() {
    return this.metricsService.findAllDefinitions();
  }

  @Get('definitions/:id')
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  findOneDefinition(@Param('id', ParseUUIDPipe) id: string) {
    return this.metricsService.findOneDefinition(id);
  }

  @Post('definitions')
  @Roles(Role.admin)
  createDefinition(@Body() createDto: CreateMetricDefinitionDto) {
    return this.metricsService.createDefinition(createDto);
  }

  @Patch('definitions/:id')
  @Roles(Role.admin)
  updateDefinition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMetricDefinitionDto,
  ) {
    return this.metricsService.updateDefinition(id, updateDto);
  }

  @Delete('definitions/:id')
  @Roles(Role.admin)
  deleteDefinition(@Param('id', ParseUUIDPipe) id: string) {
    return this.metricsService.deleteDefinition(id);
  }

  @Get('snapshots')
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  findAllSnapshots(
    @Query('metricId') metricId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.metricsService.findAllSnapshots({
      metricId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('snapshots/:metricId')
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  findSnapshotsByMetric(@Param('metricId', ParseUUIDPipe) metricId: string) {
    return this.metricsService.findSnapshotsByMetric(metricId);
  }

  @Post('compute/:metricId')
  @Roles(Role.dispatcher, Role.manager, Role.admin)
  computeMetric(
    @Param('metricId', ParseUUIDPipe) metricId: string,
    @Query('dimension') dimension?: string,
    @Query('dimensionValue') dimensionValue?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const dimensionObj = dimension && dimensionValue
      ? { type: dimension as 'global' | 'region' | 'route' | 'driver', value: dimensionValue }
      : undefined;

    const timeRange = {
      start: startDate ? new Date(startDate) : undefined,
      end: endDate ? new Date(endDate) : undefined,
    };

    return this.metricsService.computeMetric(metricId, dimensionObj, timeRange);
  }

  @Post('snapshots/generate/:metricId')
  @Roles(Role.admin)
  generateSnapshot(
    @Param('metricId', ParseUUIDPipe) metricId: string,
    @Body() body: { timeRangeStart: string; timeRangeEnd: string; dimension?: string; dimensionValue?: string },
  ) {
    const dimensionObj = body.dimension && body.dimensionValue
      ? { type: body.dimension as 'global' | 'region' | 'route' | 'driver', value: body.dimensionValue }
      : undefined;

    return this.metricsService.generateSnapshot(
      metricId,
      new Date(body.timeRangeStart),
      new Date(body.timeRangeEnd),
      dimensionObj,
    );
  }
}
