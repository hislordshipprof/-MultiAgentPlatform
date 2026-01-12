import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Edit, Search, Package, Clock, User, Calendar, CheckCircle2, XCircle, AlertCircle, MapPin } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useDeliveryChanges, useUpdateDeliveryChange, type FilterDeliveryChangesDto } from '../../hooks/api/useDeliveryChanges'
import { useDeliveryChangesWebSocket } from '../../hooks/useWebSocket'
import { useQueryClient } from '@tanstack/react-query'
import type { WebSocketEventData } from '../../services/websocket'

export default function DeliveryChanges() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'applied' | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<'reschedule' | 'update_instructions' | 'change_address' | 'all'>('all')
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null)

  // Build filters for API
  const filters: FilterDeliveryChangesDto = useMemo(() => {
    const result: FilterDeliveryChangesDto = {}
    if (statusFilter !== 'all') result.status = statusFilter
    if (typeFilter !== 'all') result.changeType = typeFilter
    return result
  }, [statusFilter, typeFilter])

  // Fetch delivery change requests with filters
  const { data: requests = [], isLoading, error } = useDeliveryChanges(filters)

  // Update request mutation
  const updateRequestMutation = useUpdateDeliveryChange()

  // Subscribe to delivery changes updates via WebSocket
  useDeliveryChangesWebSocket((_event, _data: WebSocketEventData) => {
    queryClient.invalidateQueries({ queryKey: ['delivery-changes'] })
    queryClient.invalidateQueries({ queryKey: ['delivery-changes', filters] })
    if (selectedRequestId) {
      queryClient.invalidateQueries({ queryKey: ['delivery-changes', selectedRequestId] })
    }
  })

  // Filter requests by search query
  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      const matchesSearch = 
        request.shipment?.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.requestedByUser?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.requestedByUser?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.newValue.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })
  }, [requests, searchQuery])

  // Handle opening request detail dialog
  const handleViewRequest = (requestId: string) => {
    setSelectedRequestId(requestId)
    setReviewNotes('')
    setReviewAction(null)
  }

  // Handle closing request detail dialog
  const handleCloseDialog = () => {
    setSelectedRequestId(null)
    setReviewNotes('')
    setReviewAction(null)
  }

  // Handle approving/rejecting request
  const handleReviewRequest = async () => {
    if (!selectedRequestId || !reviewAction) return

    try {
      await updateRequestMutation.mutateAsync({
        id: selectedRequestId,
        data: {
          status: reviewAction === 'approve' ? 'approved' : 'rejected',
          notes: reviewNotes || undefined,
        },
      })
      handleCloseDialog()
    } catch (error) {
      console.error('Failed to review request:', error)
      alert('Failed to review request. Please try again.')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Pending</Badge>
      case 'approved':
        return <Badge className="bg-green-100 text-green-700 border-green-300">Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      case 'applied':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-300">Applied</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'reschedule':
        return 'Reschedule Delivery'
      case 'update_instructions':
        return 'Update Instructions'
      case 'change_address':
        return 'Change Address'
      default:
        return type
    }
  }

  const selectedRequest = requests.find(r => r.id === selectedRequestId)

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="glass-card border-0 shadow-lg border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">Error loading delivery change requests. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass-card border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-primary" />
            Delivery Change Requests
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card border-0 shadow-lg hover-lift transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" /> Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{requests.filter(r => r.status === 'pending').length}</div>
            <p className="text-xs text-yellow-500">Awaiting review</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg hover-lift transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{requests.filter(r => r.status === 'approved').length}</div>
            <p className="text-xs text-green-500">Approved requests</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg hover-lift transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" /> Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{requests.filter(r => r.status === 'rejected').length}</div>
            <p className="text-xs text-red-500">Rejected requests</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg hover-lift transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" /> Applied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{requests.filter(r => r.status === 'applied').length}</div>
            <p className="text-xs text-blue-500">Changes applied</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card className="glass-card border-0 shadow-lg">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tracking number, customer, or value..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="applied">Applied</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Types</option>
              <option value="reschedule">Reschedule</option>
              <option value="update_instructions">Update Instructions</option>
              <option value="change_address">Change Address</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading requests...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No delivery change requests found matching your criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>New Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          {request.shipment?.trackingNumber || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(request.changeType)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{request.requestedByUser?.name || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{request.requestedByUser?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {request.changeType === 'reschedule' && request.newDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{new Date(request.newDate).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span title={request.newValue}>{request.newValue}</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewRequest(request.id)}
                        >
                          <Search className="h-4 w-4 mr-1" /> View
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

      {/* Request Detail Dialog */}
      <Dialog open={!!selectedRequestId} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5 text-primary" />
                  Delivery Change Request Details
                </DialogTitle>
                <DialogDescription>
                  Review and approve or reject this delivery change request
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Request Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Tracking Number</Label>
                    <p className="font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {selectedRequest.shipment?.trackingNumber || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Change Type</Label>
                    <p className="font-medium">{getTypeLabel(selectedRequest.changeType)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Requested By</Label>
                    <p className="font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {selectedRequest.requestedByUser?.name || 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedRequest.requestedByUser?.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Requested On</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {new Date(selectedRequest.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {selectedRequest.reviewedAt && (
                    <div>
                      <Label className="text-muted-foreground">Reviewed On</Label>
                      <p className="font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {new Date(selectedRequest.reviewedAt).toLocaleString()}
                      </p>
                      {selectedRequest.reviewedByUser && (
                        <p className="text-sm text-muted-foreground">By {selectedRequest.reviewedByUser.name}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Shipment Info */}
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground mb-2 block">Shipment Information</Label>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Current Status:</span>
                      <p className="font-medium">{selectedRequest.shipment?.currentStatus || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Destination:</span>
                      <p className="font-medium flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {selectedRequest.shipment?.toAddress || 'N/A'}
                      </p>
                    </div>
                    {selectedRequest.shipment?.promisedDeliveryDate && (
                      <div>
                        <span className="text-muted-foreground">Current ETA:</span>
                        <p className="font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(selectedRequest.shipment.promisedDeliveryDate).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Change Details */}
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground mb-2 block">Requested Change</Label>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    {selectedRequest.changeType === 'reschedule' && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">New Delivery Date:</p>
                        <p className="font-semibold flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {selectedRequest.newDate 
                            ? new Date(selectedRequest.newDate).toLocaleString()
                            : selectedRequest.newValue}
                        </p>
                      </div>
                    )}
                    {selectedRequest.changeType === 'update_instructions' && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">New Instructions:</p>
                        <p className="font-medium">{selectedRequest.newValue}</p>
                      </div>
                    )}
                    {selectedRequest.changeType === 'change_address' && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">New Address:</p>
                        <p className="font-medium">{selectedRequest.newValue}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Existing Notes */}
                {selectedRequest.notes && (
                  <div className="border-t pt-4">
                    <Label className="text-muted-foreground mb-2 block">Notes</Label>
                    <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedRequest.notes}</p>
                  </div>
                )}

                {/* Review Section (only for pending requests) */}
                {selectedRequest.status === 'pending' && (
                  <div className="border-t pt-4 space-y-4">
                    <Label className="text-muted-foreground mb-2 block">Review Notes</Label>
                    <Textarea
                      placeholder="Add notes about your decision (optional)..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-3">
                      <Button
                        onClick={() => {
                          setReviewAction('approve')
                          handleReviewRequest()
                        }}
                        disabled={updateRequestMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {updateRequestMutation.isPending ? 'Processing...' : 'Approve'}
                      </Button>
                      <Button
                        onClick={() => {
                          setReviewAction('reject')
                          handleReviewRequest()
                        }}
                        disabled={updateRequestMutation.isPending}
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {updateRequestMutation.isPending ? 'Processing...' : 'Reject'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Review Info (for reviewed requests) */}
                {selectedRequest.status !== 'pending' && selectedRequest.reviewedByUser && (
                  <div className="border-t pt-4">
                    <Label className="text-muted-foreground mb-2 block">Review Information</Label>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-sm">
                        <span className="font-medium">Reviewed by:</span> {selectedRequest.reviewedByUser.name}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Status:</span> {selectedRequest.status}
                      </p>
                      {selectedRequest.notes && (
                        <p className="text-sm mt-2">
                          <span className="font-medium">Notes:</span> {selectedRequest.notes}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
