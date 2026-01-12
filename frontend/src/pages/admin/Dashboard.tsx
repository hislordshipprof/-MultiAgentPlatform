import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useMetricsOverview } from '../../hooks/api/useMetrics'
import { useShipments } from '../../hooks/api/useShipments'
import { useMetricsWebSocket, useWebSocket } from '../../hooks/useWebSocket'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Package, AlertCircle, Truck, TrendingUp } from 'lucide-react'
import type { WebSocketEventData } from '../../services/websocket'

export default function AdminDashboard() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Fetch metrics overview
  const { data: metrics, isLoading: isLoadingMetrics, error: metricsError } = useMetricsOverview()

  // Fetch shipments (limit to recent 10 for dashboard)
  const { data: shipments, isLoading: isLoadingShipments, error: shipmentsError } = useShipments()

  // WebSocket subscription for metrics updates
  useMetricsWebSocket((event, _data: WebSocketEventData) => {
    if (event === 'metrics.snapshot.created') {
      queryClient.invalidateQueries({ queryKey: ['metrics', 'overview'] })
    }
  })

  // WebSocket subscription for general shipment updates (invalidate queries on any shipment event)
  // Note: For a dashboard showing all shipments, we listen to the issues channel which broadcasts shipment updates
  useWebSocket({
    channels: ['issues'], // Issues channel also receives shipment-related events
    events: ['shipment.scan.created', 'shipment.status.updated'],
    onEvent: (event, _data: WebSocketEventData) => {
      if (event === 'shipment.scan.created' || event === 'shipment.status.updated') {
        queryClient.invalidateQueries({ queryKey: ['shipments'] })
      }
    },
  })

  // Get recent shipments (last 10, sorted by updatedAt)
  const recentShipments = shipments 
    ? [...shipments]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10)
    : []

  // Format status badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      'PENDING': { variant: 'secondary', label: 'Pending' },
      'picked_up': { variant: 'default', label: 'Picked Up' },
      'in_transit': { variant: 'default', label: 'In Transit' },
      'out_for_delivery': { variant: 'default', label: 'Out for Delivery' },
      'delivered': { variant: 'default', label: 'Delivered' },
      'failed': { variant: 'destructive', label: 'Failed' },
      'returned': { variant: 'destructive', label: 'Returned' },
    }
    const statusInfo = statusMap[status] || { variant: 'secondary' as const, label: status }
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }

  // Format date for ETA display
  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return 'N/A'
    const d = new Date(date)
    const now = new Date()
    const diffMs = d.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (Math.abs(diffHours) < 24) {
      return diffHours > 0 ? `In ${diffHours}h` : `${Math.abs(diffHours)}h ago`
    }
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Calculate total shipments count
  const totalShipments = shipments?.length || 0

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card border-0 shadow-lg hover-lift transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total Shipments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingShipments ? (
              <div className="text-2xl font-bold text-muted-foreground">-</div>
            ) : shipmentsError ? (
              <div className="text-sm text-destructive">Error loading</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{totalShipments.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">All shipments</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-0 shadow-lg hover-lift transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              On-Time Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <div className="text-2xl font-bold text-muted-foreground">-</div>
            ) : metricsError ? (
              <div className="text-sm text-destructive">Error loading</div>
            ) : metrics ? (
              <>
                <div className="text-2xl font-bold">
                  {(metrics.onTimeDeliveryRate * 100).toFixed(1)}%
                </div>
                <p className={`text-xs ${metrics.onTimeDeliveryRate >= 0.95 ? 'text-green-500' : 'text-red-500'}`}>
                  {metrics.onTimeDeliveryRate >= 0.95 ? 'On target' : 'Below target (95%)'}
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">-</div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-0 shadow-lg hover-lift transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Active Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <div className="text-2xl font-bold text-muted-foreground">-</div>
            ) : metricsError ? (
              <div className="text-sm text-destructive">Error loading</div>
            ) : metrics ? (
              <>
                <div className="text-2xl font-bold">{metrics.openIssuesCount}</div>
                <p className="text-xs text-yellow-500">
                  {metrics.openIssuesCount > 0 ? 'Requires attention' : 'No open issues'}
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">-</div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-0 shadow-lg hover-lift transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4" />
              SLA-Risk Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <div className="text-2xl font-bold text-muted-foreground">-</div>
            ) : metricsError ? (
              <div className="text-sm text-destructive">Error loading</div>
            ) : metrics ? (
              <>
                <div className="text-2xl font-bold">{metrics.slaRiskCount}</div>
                <p className={`text-xs ${metrics.slaRiskCount > 10 ? 'text-red-500' : 'text-green-500'}`}>
                  {metrics.slaRiskCount > 10 ? 'High risk' : 'Within threshold'}
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">-</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live Shipments Table */}
      <Card className="glass-card border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Recent Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingShipments ? (
            <div className="text-center py-8 text-muted-foreground">Loading shipments...</div>
          ) : shipmentsError ? (
            <div className="text-center py-8 text-destructive">Error loading shipments. Please try again.</div>
          ) : recentShipments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No shipments found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentShipments.map((shipment) => (
                  <TableRow key={shipment.id} className="hover:bg-muted/50 cursor-pointer">
                    <TableCell className="font-medium">{shipment.trackingNumber}</TableCell>
                    <TableCell>
                      {getStatusBadge(shipment.currentStatus)}
                    </TableCell>
                    <TableCell>
                      {shipment.lastScanLocation || shipment.toAddress || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {formatDate(shipment.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => navigate(`/dashboard/admin/shipments?tracking=${shipment.trackingNumber}`)}
                        className="text-blue-500 hover:underline"
                      >
                        View
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}