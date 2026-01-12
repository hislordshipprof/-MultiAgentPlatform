import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Route as RouteIcon, MapPin, User, Truck, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useRoutes, useRoute, useRouteStops } from '../../hooks/api/useRoutes'
import { useRouteWebSocket } from '../../hooks/useWebSocket'
import { useQueryClient } from '@tanstack/react-query'
import type { WebSocketEventData } from '../../services/websocket'

export default function Routes() {
  const queryClient = useQueryClient()
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)

  // Fetch routes
  const { data: routesData, isLoading, error } = useRoutes()
  const routes = routesData || []

  // Fetch selected route details
  const { data: selectedRoute, isLoading: isLoadingRoute } = useRoute(selectedRouteId)

  // Fetch route stops
  const { data: routeStops = [], isLoading: isLoadingStops } = useRouteStops(selectedRouteId)

  // Subscribe to route updates via WebSocket
  useRouteWebSocket(
    selectedRoute?.routeCode || null,
    (_event, _data: WebSocketEventData) => {
      if (selectedRouteId) {
        queryClient.invalidateQueries({ queryKey: ['routes', selectedRouteId] })
        queryClient.invalidateQueries({ queryKey: ['routes', selectedRouteId, 'stops'] })
        queryClient.invalidateQueries({ queryKey: ['routes'] })
      }
    }
  )

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 border-green-300">Completed</Badge>
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-300">In Progress</Badge>
      case 'planned':
        return <Badge className="bg-gray-100 text-gray-700 border-gray-300">Planned</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getStopStatusIcon = (status: string) => {
    switch(status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <XCircle className="h-4 w-4 text-gray-400" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  // Calculate progress for route
  const getRouteProgress = (route: typeof routes[0]) => {
    if (!route.stops || route.stops.length === 0) return { completed: 0, total: 0 }
    // A stop is considered completed if status is 'completed' OR if it has an actualArrival time
    const completed = route.stops.filter((stop: any) => stop.status === 'completed' || stop.actualArrival).length
    return { completed, total: route.stops.length }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="glass-card border-0 shadow-lg border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">Error loading routes. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!selectedRouteId ? (
        <>
          {/* Routes List */}
          <Card className="glass-card border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RouteIcon className="h-5 w-5 text-primary" />
                Routes Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading routes...</div>
              ) : routes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No routes found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-muted/50">
                        <TableHead>Route Code</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {routes.map((route) => {
                        const progress = getRouteProgress(route)
                        return (
                          <TableRow 
                            key={route.id} 
                            className="hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => setSelectedRouteId(route.id)}
                          >
                            <TableCell className="font-semibold">{route.routeCode}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{new Date(route.date).toLocaleDateString()}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {route.driver?.user ? (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">{route.driver.user.name}</p>
                                    <p className="text-xs text-muted-foreground">{route.driver.driverCode}</p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">-</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>{route.region}</span>
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(route.status)}</TableCell>
                            <TableCell>
                              {progress.total > 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-20 bg-muted rounded-full h-2">
                                    <div
                                      className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-300"
                                      style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {progress.completed}/{progress.total}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="hover-lift"
                                onClick={() => setSelectedRouteId(route.id)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Route Detail View */}
          <Card className="glass-card border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedRouteId(null)}
                  >
                    ← Back
                  </Button>
                  <CardTitle className="flex items-center gap-2">
                    <RouteIcon className="h-5 w-5 text-primary" />
                    Route {selectedRoute?.routeCode || ''} - Detail
                  </CardTitle>
                </div>
                {selectedRoute && getStatusBadge(selectedRoute.status)}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingRoute ? (
                <div className="text-center py-8 text-muted-foreground">Loading route details...</div>
              ) : selectedRoute ? (
                <div className="space-y-6">
                  {/* Route Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Driver</p>
                      {selectedRoute.driver?.user ? (
                        <>
                          <p className="font-semibold">{selectedRoute.driver.user.name}</p>
                          <p className="text-xs text-muted-foreground">{selectedRoute.driver.driverCode}</p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">-</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Vehicle</p>
                      {selectedRoute.vehicle ? (
                        <>
                          <p className="font-semibold">{selectedRoute.vehicle.vehicleCode}</p>
                          <p className="text-xs text-muted-foreground capitalize">{selectedRoute.vehicle.vehicleType}</p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">-</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Region</p>
                      <p className="font-semibold">{selectedRoute.region}</p>
                      <p className="text-xs text-muted-foreground">{selectedRoute.stops?.length || 0} stops</p>
                    </div>
                  </div>

                  {/* Route Stops */}
                  <div>
                    <CardTitle className="mb-4 flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Route Stops ({routeStops?.filter(s => s.status === 'completed' || s.actualArrival).length || 0}/{routeStops?.length || 0})
                    </CardTitle>
                    {isLoadingStops ? (
                      <div className="text-center py-8 text-muted-foreground">Loading stops...</div>
                    ) : !routeStops || routeStops.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No stops found.</div>
                    ) : (
                      <div className="space-y-3">
                        {routeStops.map((stop, index) => (
                          <div
                            key={stop.id}
                            className="flex items-start gap-4 p-4 rounded-lg border-2 transition-all duration-200 hover-lift"
                            style={{
                              borderColor: stop.status === 'completed' 
                                ? 'rgb(34 197 94)' 
                                : stop.status === 'failed'
                                ? 'rgb(239 68 68)'
                                : 'rgb(229 231 235)'
                            }}
                          >
                            <div className="flex flex-col items-center pt-1">
                              <div className={`
                                flex items-center justify-center w-8 h-8 rounded-full border-2 font-semibold text-sm
                                ${stop.status === 'completed' 
                                  ? 'bg-green-100 border-green-500 text-green-700' 
                                  : stop.status === 'failed'
                                  ? 'bg-red-100 border-red-500 text-red-700'
                                  : 'bg-gray-100 border-gray-300 text-gray-500'
                                }
                              `}>
                                {stop.sequenceNumber}
                              </div>
                              {routeStops && index < routeStops.length - 1 && (
                                <div className={`w-0.5 h-full mt-2 ${
                                  stop.status === 'completed' ? 'bg-green-300' : 'bg-gray-200'
                                }`}></div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {getStopStatusIcon(stop.status)}
                                  <p className="font-semibold text-foreground">{stop.shipment?.trackingNumber || stop.shipmentId}</p>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  {stop.plannedEta && (
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      <span>ETA: {new Date(stop.plannedEta).toLocaleTimeString()}</span>
                                    </div>
                                  )}
                                  {stop.actualArrival && (
                                    <div className="flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                                      <span>Actual: {new Date(stop.actualArrival).toLocaleTimeString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {stop.shipment?.toAddress && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {stop.shipment.toAddress}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">Route not found.</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
