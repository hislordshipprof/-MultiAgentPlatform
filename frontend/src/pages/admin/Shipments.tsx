import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Search, Eye, Package, MapPin, Clock, AlertTriangle, User, Calendar } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useShipments, useShipment, useShipmentTimeline } from '../../hooks/api/useShipments'
import { useQueryClient } from '@tanstack/react-query'
import { useWebSocket } from '../../hooks/useWebSocket'
import type { WebSocketEventData } from '../../services/websocket'

export default function Shipments() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null)

  // Fetch shipments
  const { data: shipments = [], isLoading, error } = useShipments()
  
  // Fetch selected shipment details and timeline
  const { data: selectedShipment, isLoading: isLoadingSelected } = useShipment(selectedShipmentId)
  const { data: timeline = [], isLoading: isLoadingTimeline } = useShipmentTimeline(selectedShipmentId)

  // Subscribe to shipment updates via WebSocket for all shipments
  useWebSocket({
    channels: ['issues'], // Issues channel also receives shipment-related events
    events: ['shipment.scan.created', 'shipment.status.updated'],
    onEvent: (event, _data: WebSocketEventData) => {
      if (event === 'shipment.scan.created' || event === 'shipment.status.updated') {
        queryClient.invalidateQueries({ queryKey: ['shipments'] })
        if (selectedShipmentId) {
          queryClient.invalidateQueries({ queryKey: ['shipments', selectedShipmentId] })
          queryClient.invalidateQueries({ queryKey: ['shipments', selectedShipmentId, 'timeline'] })
        }
      }
    }
  })

  const handleViewShipment = (shipmentId: string) => {
    setSelectedShipmentId(shipmentId)
  }

  const handleCloseDialog = () => {
    setSelectedShipmentId(null)
  }

  const getStatusBadge = (status: string, slaRisk: number) => {
    if (status === 'delivered') {
      return <Badge className="bg-green-100 text-green-700 border-green-300">Delivered</Badge>
    }
    if (status === 'out_for_delivery') {
      return <Badge className="bg-blue-100 text-blue-700 border-blue-300">Out for Delivery</Badge>
    }
    if (status === 'failed' || status === 'returned' || slaRisk > 0.7) {
      return <Badge variant="destructive">Delayed / Risk</Badge>
    }
    if (status === 'in_transit') {
      return <Badge className="bg-teal-100 text-teal-700 border-teal-300">In Transit</Badge>
    }
    return <Badge className="bg-gray-100 text-gray-700 border-gray-300">Pending</Badge>
  }

  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => {
      const matchesSearch = shipment.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (shipment.customer?.name || shipment.customer?.email || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || shipment.currentStatus === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [shipments, searchQuery, statusFilter])

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="glass-card border-0 shadow-lg border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">Error loading shipments. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="glass-card border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Shipments Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tracking number or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="in_transit">In Transit</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="returned">Returned</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Shipments Table */}
      <Card className="glass-card border-0 shadow-lg hover-lift">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Live Shipments ({filteredShipments.length})</CardTitle>
            <Badge variant="secondary">{filteredShipments.length} total</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading shipments...</div>
          ) : filteredShipments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No shipments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-muted/50">
                    <TableHead>Tracking #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Current Location</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead>SLA Risk</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShipments.map((shipment) => (
                    <TableRow key={shipment.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          {shipment.isVip && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">VIP</Badge>
                          )}
                          <span>{shipment.trackingNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(shipment.currentStatus, shipment.slaRiskScore || 0)}
                      </TableCell>
                      <TableCell>
                        {shipment.customer?.name || shipment.customer?.email || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span className="text-muted-foreground text-xs">{shipment.fromAddress}</span>
                          <span className="font-medium">{shipment.toAddress}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {shipment.lastScanLocation ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span>{shipment.lastScanLocation}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {shipment.promisedDeliveryDate ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>{new Date(shipment.promisedDeliveryDate).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                (shipment.slaRiskScore || 0) > 0.7 
                                  ? 'bg-red-500' 
                                  : (shipment.slaRiskScore || 0) > 0.4
                                  ? 'bg-orange-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${((shipment.slaRiskScore || 0) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            {((shipment.slaRiskScore || 0) * 100).toFixed(0)}%
                          </span>
                          {(shipment.slaRiskScore || 0) > 0.7 && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="gap-1 hover-lift" onClick={() => handleViewShipment(shipment.id)}>
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipment Detail Dialog */}
      <Dialog open={!!selectedShipmentId} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Shipment Details: {selectedShipment?.trackingNumber || selectedShipmentId}
            </DialogTitle>
            <DialogDescription>
              View the detailed information and tracking timeline for this shipment.
            </DialogDescription>
          </DialogHeader>
          {isLoadingSelected ? (
            <div className="text-center py-8 text-muted-foreground">Loading shipment details...</div>
          ) : selectedShipment ? (
            <div className="grid gap-4 py-4">
              {/* Shipment Summary Card */}
              <Card className="glass-card border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      Summary
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedShipment.currentStatus, selectedShipment.slaRiskScore || 0)}
                      {selectedShipment.isVip && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">VIP</Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <div className="grid grid-cols-2 items-center gap-4">
                    <Label>Tracking Number</Label>
                    <p className="text-sm font-semibold">{selectedShipment.trackingNumber}</p>
                  </div>
                  <div className="grid grid-cols-2 items-center gap-4">
                    <Label>Customer</Label>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedShipment.customer?.name || selectedShipment.customer?.email || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 items-center gap-4">
                    <Label>Service Level</Label>
                    <p className="text-sm">{selectedShipment.serviceLevel}</p>
                  </div>
                  <div className="grid grid-cols-2 items-center gap-4">
                    <Label>From Address</Label>
                    <p className="text-sm">{selectedShipment.fromAddress}</p>
                  </div>
                  <div className="grid grid-cols-2 items-center gap-4">
                    <Label>To Address</Label>
                    <p className="text-sm">{selectedShipment.toAddress}</p>
                  </div>
                  <div className="grid grid-cols-2 items-center gap-4">
                    <Label>Promised Delivery Date</Label>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedShipment.promisedDeliveryDate ? new Date(selectedShipment.promisedDeliveryDate).toLocaleString() : 'N/A'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 items-center gap-4">
                    <Label>Current Status</Label>
                    <Badge>{selectedShipment.currentStatus}</Badge>
                  </div>
                  <div className="grid grid-cols-2 items-center gap-4">
                    <Label>Last Scan Location</Label>
                    {selectedShipment.lastScanLocation ? (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedShipment.lastScanLocation}</span>
                        {selectedShipment.lastScanAt && (
                          <span className="text-xs text-muted-foreground">
                            at {new Date(selectedShipment.lastScanAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 items-center gap-4">
                    <Label>SLA Risk Score</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            (selectedShipment.slaRiskScore || 0) > 0.7 
                              ? 'bg-red-500' 
                              : (selectedShipment.slaRiskScore || 0) > 0.4
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${((selectedShipment.slaRiskScore || 0) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {((selectedShipment.slaRiskScore || 0) * 100).toFixed(0)}%
                      </span>
                      {(selectedShipment.slaRiskScore || 0) > 0.7 && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tracking Timeline */}
              <Card className="glass-card border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    Tracking Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingTimeline ? (
                    <div className="text-center py-8 text-muted-foreground">Loading timeline...</div>
                  ) : timeline && timeline.length > 0 ? (
                    <div className="space-y-4">
                      {timeline.map((event: any, index: number) => (
                        <div key={index} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`h-3 w-3 rounded-full ${
                              index === 0 ? 'bg-primary' : 'bg-muted'
                            }`}></div>
                            {index < timeline.length - 1 && (
                              <div className="w-0.5 h-full bg-border mt-1"></div>
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="font-medium text-foreground">{event.description || event.type}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(event.timestamp).toLocaleString()}
                            </p>
                            {event.location && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>{event.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">No tracking information available.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Shipment details not found.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
