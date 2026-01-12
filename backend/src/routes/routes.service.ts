import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { CreateRouteStopDto } from './dto/create-route-stop.dto';
import { UpdateRouteStopDto } from './dto/update-route-stop.dto';
import { Role, RouteStatus } from '@prisma/client';

@Injectable()
export class RoutesService {
  constructor(private prisma: PrismaService) {}

  async create(createRouteDto: CreateRouteDto, userId: string, userRole: Role) {
    // Validate driver exists if provided
    if (createRouteDto.driverId) {
      const driver = await this.prisma.driver.findUnique({
        where: { id: createRouteDto.driverId },
      });
      if (!driver) {
        throw new NotFoundException('Driver not found');
      }
    }

    // Validate vehicle exists if provided
    if (createRouteDto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: createRouteDto.vehicleId },
      });
      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }
    }

    // Check if routeCode already exists
    const existingRoute = await this.prisma.route.findUnique({
      where: { routeCode: createRouteDto.routeCode },
    });
    if (existingRoute) {
      throw new BadRequestException('Route code already exists');
    }

    return this.prisma.route.create({
      data: {
        routeCode: createRouteDto.routeCode,
        date: new Date(createRouteDto.date),
        driverId: createRouteDto.driverId,
        vehicleId: createRouteDto.vehicleId,
        region: createRouteDto.region,
        status: createRouteDto.status || RouteStatus.planned,
      },
      include: {
        driver: {
          include: {
            user: true,
          },
        },
        vehicle: true,
        stops: {
          include: {
            shipment: true,
          },
          orderBy: {
            sequenceNumber: 'asc',
          },
        },
      },
    });
  }

  async findAll(filters: { date?: string; driverId?: string; region?: string }, userId: string, userRole: Role) {
    const where: any = {};

    if (filters.date) {
      where.date = new Date(filters.date);
    }

    if (filters.driverId) {
      where.driverId = filters.driverId;
    } else if (userRole === Role.driver) {
      // Drivers can only see their own routes
      const driver = await this.prisma.driver.findFirst({
        where: { userId },
      });
      if (!driver) {
        return [];
      }
      where.driverId = driver.id;
    }

    // RBAC: Dispatchers can only see routes in their assigned region
    if (userRole === Role.dispatcher) {
      const dispatcherProfile = await this.prisma.dispatcherProfile.findUnique({
        where: { userId },
      });

      if (!dispatcherProfile) {
        return []; // No profile = no access
      }

      // Override region filter with dispatcher's assigned region
      where.region = dispatcherProfile.assignedRegion;
    } else if (filters.region) {
      // Apply region filter for non-dispatcher roles (if explicitly provided)
      where.region = filters.region;
    }

    return this.prisma.route.findMany({
      where,
      include: {
        driver: {
          include: {
            user: true,
          },
        },
        vehicle: true,
        stops: {
          include: {
            shipment: true,
          },
          orderBy: {
            sequenceNumber: 'asc',
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string, userRole: Role) {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: {
        driver: {
          include: {
            user: true,
          },
        },
        vehicle: true,
        stops: {
          include: {
            shipment: {
              include: {
                scans: {
                  orderBy: {
                    timestamp: 'desc',
                  },
                },
              },
            },
          },
          orderBy: {
            sequenceNumber: 'asc',
          },
        },
      },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    // RBAC: Drivers can only see their own routes
    if (userRole === Role.driver) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId },
      });
      if (!driver || route.driverId !== driver.id) {
        throw new ForbiddenException('Access denied: You can only view your own routes');
      }
    }

    return route;
  }

  async update(id: string, updateRouteDto: UpdateRouteDto, userId: string, userRole: Role) {
    const route = await this.prisma.route.findUnique({
      where: { id },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    // Validate driver exists if provided
    if (updateRouteDto.driverId) {
      const driver = await this.prisma.driver.findUnique({
        where: { id: updateRouteDto.driverId },
      });
      if (!driver) {
        throw new NotFoundException('Driver not found');
      }
    }

    // Validate vehicle exists if provided
    if (updateRouteDto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: updateRouteDto.vehicleId },
      });
      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }
    }

    const updateData: any = {};
    if (updateRouteDto.date !== undefined) {
      updateData.date = new Date(updateRouteDto.date);
    }
    if (updateRouteDto.driverId !== undefined) {
      updateData.driverId = updateRouteDto.driverId;
    }
    if (updateRouteDto.vehicleId !== undefined) {
      updateData.vehicleId = updateRouteDto.vehicleId;
    }
    if (updateRouteDto.region !== undefined) {
      updateData.region = updateRouteDto.region;
    }
    if (updateRouteDto.status !== undefined) {
      updateData.status = updateRouteDto.status;
    }

    return this.prisma.route.update({
      where: { id },
      data: updateData,
      include: {
        driver: {
          include: {
            user: true,
          },
        },
        vehicle: true,
        stops: {
          include: {
            shipment: true,
          },
          orderBy: {
            sequenceNumber: 'asc',
          },
        },
      },
    });
  }

  async getRouteStops(routeId: string, userId: string, userRole: Role) {
    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    // RBAC: Drivers can only see stops for their own routes
    if (userRole === Role.driver) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId },
      });
      if (!driver || route.driverId !== driver.id) {
        throw new ForbiddenException('Access denied: You can only view stops for your own routes');
      }
    }

    return this.prisma.routeStop.findMany({
      where: { routeId },
      include: {
        shipment: {
          include: {
            scans: {
              orderBy: {
                timestamp: 'desc',
              },
            },
          },
        },
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });
  }

  async createRouteStop(routeId: string, createStopDto: CreateRouteStopDto, userId: string, userRole: Role) {
    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
      include: {
        stops: true,
      },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    // Validate shipment exists
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: createStopDto.shipmentId },
    });
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // Check if shipment is already in this route
    const existingStop = route.stops.find((stop) => stop.shipmentId === createStopDto.shipmentId);
    if (existingStop) {
      throw new BadRequestException('Shipment is already in this route');
    }

    // Validate sequence number doesn't conflict
    const conflictingStop = route.stops.find((stop) => stop.sequenceNumber === createStopDto.sequenceNumber);
    if (conflictingStop) {
      throw new BadRequestException('Sequence number already exists in this route');
    }

    return this.prisma.routeStop.create({
      data: {
        routeId,
        shipmentId: createStopDto.shipmentId,
        sequenceNumber: createStopDto.sequenceNumber,
        plannedEta: createStopDto.plannedEta ? new Date(createStopDto.plannedEta) : null,
      },
      include: {
        shipment: true,
      },
    });
  }

  async updateRouteStop(
    routeId: string,
    stopId: string,
    updateStopDto: UpdateRouteStopDto,
    userId: string,
    userRole: Role,
  ) {
    const stop = await this.prisma.routeStop.findUnique({
      where: { id: stopId },
      include: {
        route: {
          include: {
            driver: true,
          },
        },
      },
    });

    if (!stop || stop.routeId !== routeId) {
      throw new NotFoundException('Route stop not found');
    }

    // RBAC: Drivers can only update stops for their own routes
    if (userRole === Role.driver) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId },
      });
      if (!driver || stop.route.driverId !== driver.id) {
        throw new ForbiddenException('Access denied: You can only update stops for your own routes');
      }
    }

    const updateData: any = {};
    if (updateStopDto.sequenceNumber !== undefined) {
      // Validate sequence number doesn't conflict with other stops
      const conflictingStop = await this.prisma.routeStop.findFirst({
        where: {
          routeId,
          sequenceNumber: updateStopDto.sequenceNumber,
          id: { not: stopId },
        },
      });
      if (conflictingStop) {
        throw new BadRequestException('Sequence number already exists in this route');
      }
      updateData.sequenceNumber = updateStopDto.sequenceNumber;
    }
    if (updateStopDto.plannedEta !== undefined) {
      updateData.plannedEta = updateStopDto.plannedEta ? new Date(updateStopDto.plannedEta) : null;
    }
    if (updateStopDto.actualArrival !== undefined) {
      updateData.actualArrival = updateStopDto.actualArrival ? new Date(updateStopDto.actualArrival) : null;
    }
    if (updateStopDto.status !== undefined) {
      updateData.status = updateStopDto.status;
    }

    return this.prisma.routeStop.update({
      where: { id: stopId },
      data: updateData,
      include: {
        shipment: true,
      },
    });
  }

  async getDriverRoutes(driverId: string, userId: string, userRole: Role) {
    // RBAC: Drivers can only see their own routes
    if (userRole === Role.driver) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId },
      });
      if (!driver || driver.id !== driverId) {
        throw new ForbiddenException('Access denied: You can only view your own routes');
      }
    }

    // Validate driver exists
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return this.prisma.route.findMany({
      where: { driverId },
      include: {
        driver: {
          include: {
            user: true,
          },
        },
        vehicle: true,
        stops: {
          include: {
            shipment: true,
          },
          orderBy: {
            sequenceNumber: 'asc',
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
  }
}
