import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, Search, Eye, Package, Clock, TrendingUp, User, Calendar, FileText } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useIssues, useIssue, useUpdateIssue, type FilterIssuesDto } from '../../hooks/api/useIssues'
import { useIssuesWebSocket } from '../../hooks/useWebSocket'
import { useQueryClient } from '@tanstack/react-query'
import type { WebSocketEventData } from '../../services/websocket'

export default function Issues() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<'critical' | 'high' | 'medium' | 'low' | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'open' | 'investigating' | 'resolved' | 'closed' | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<string>('')
  const [updateResolutionNotes, setUpdateResolutionNotes] = useState<string>('')

  // Build filters for API
  const filters: FilterIssuesDto = useMemo(() => {
    const result: FilterIssuesDto = {}
    if (statusFilter !== 'all') result.status = statusFilter
    if (severityFilter !== 'all') result.severity = severityFilter
    if (typeFilter !== 'all') result.issueType = typeFilter as any
    return result
  }, [severityFilter, statusFilter, typeFilter])

  // Fetch issues with filters
  const { data: issues = [], isLoading, error } = useIssues(filters)

  // Fetch selected issue details
  const { data: selectedIssue, isLoading: isLoadingIssue } = useIssue(selectedIssueId)

  // Update issue mutation
  const updateIssueMutation = useUpdateIssue()

  // Subscribe to issues updates via WebSocket
  useIssuesWebSocket((_event, _data: WebSocketEventData) => {
    queryClient.invalidateQueries({ queryKey: ['issues'] })
    queryClient.invalidateQueries({ queryKey: ['issues', filters] })
    if (selectedIssueId) {
      queryClient.invalidateQueries({ queryKey: ['issues', selectedIssueId] })
    }
  })

  // Handle opening issue detail dialog
  const handleViewIssue = (issueId: string) => {
    setSelectedIssueId(issueId)
    // Reset update fields - will be populated from selectedIssue when it loads
    setUpdateStatus('')
    setUpdateResolutionNotes('')
  }

  // Handle closing issue detail dialog
  const handleCloseDialog = () => {
    setSelectedIssueId(null)
    setUpdateStatus('')
    setUpdateResolutionNotes('')
  }

  // Handle updating issue
  const handleUpdateIssue = async () => {
    if (!selectedIssueId || !selectedIssue) return

    const updateData: any = {}
    const newStatus = updateStatus || selectedIssue.status
    if (newStatus !== selectedIssue.status) {
      updateData.status = newStatus
    }
    const newNotes = updateResolutionNotes || selectedIssue.resolutionNotes || ''
    if (newNotes !== (selectedIssue.resolutionNotes || '')) {
      updateData.resolutionNotes = newNotes || null
    }

    if (Object.keys(updateData).length > 0) {
      try {
        await updateIssueMutation.mutateAsync({
          id: selectedIssueId,
          data: updateData,
        })
        handleCloseDialog()
      } catch (error) {
        console.error('Failed to update issue:', error)
        alert('Failed to update issue. Please try again.')
      }
    }
  }

  const getSeverityBadge = (severity: number) => {
    if (severity >= 0.8) {
      return <Badge variant="destructive" className="gap-1"><TrendingUp className="h-3 w-3" /> Critical ({Math.round(severity * 100)}%)</Badge>
    } else if (severity >= 0.5) {
      return <Badge className="bg-orange-100 text-orange-700 border-orange-300">High ({Math.round(severity * 100)}%)</Badge>
    } else {
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Medium ({Math.round(severity * 100)}%)</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'resolved':
        return <Badge className="bg-green-100 text-green-700 border-green-300">Resolved</Badge>
      case 'investigating':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-300">Investigating</Badge>
      case 'closed':
        return <Badge className="bg-gray-100 text-gray-700 border-gray-300">Closed</Badge>
      default:
        return <Badge variant="secondary">Open</Badge>
    }
  }

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'damaged':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'missing':
        return 'bg-orange-100 text-orange-700 border-orange-300'
      case 'wrong_address':
        return 'bg-purple-100 text-purple-700 border-purple-300'
      case 'delay':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'missed_delivery':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'damaged': 'Damaged Package',
      'missing': 'Missing Items',
      'wrong_address': 'Wrong Address',
      'delay': 'Delivery Delay',
      'missed_delivery': 'Missed Delivery',
      'other': 'Other',
    }
    return labels[type] || type
  }

  // Client-side search filtering (API can also handle this)
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      const matchesSearch = searchQuery === '' ||
        issue.shipment?.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.reportedByUser?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.reportedByUser?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })
  }, [issues, searchQuery])

  const criticalCount = filteredIssues.filter(i => i.aiSeverityScore >= 0.8 && i.status !== 'resolved' && i.status !== 'closed').length
  const openCount = filteredIssues.filter(i => i.status === 'open' || i.status === 'investigating').length

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="glass-card border-0 shadow-lg border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">Error loading issues. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card border-0 shadow-lg hover-lift">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{filteredIssues.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All issues</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg hover-lift border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Critical Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-xs text-red-500 mt-1">Requires immediate attention</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg hover-lift border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{openCount}</div>
            <p className="text-xs text-blue-500 mt-1">Active investigations</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg hover-lift border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {filteredIssues.filter(i => i.status === 'resolved').length}
            </div>
            <p className="text-xs text-green-500 mt-1">Successfully resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Issues Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by shipment ID, reporter, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as any)}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical (≥80%)</option>
                <option value="high">High (50-79%)</option>
                <option value="medium">Medium (&lt;50%)</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All Types</option>
                <option value="damaged">Damaged</option>
                <option value="missing">Missing</option>
                <option value="wrong_address">Wrong Address</option>
                <option value="delay">Delay</option>
                <option value="missed_delivery">Missed Delivery</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues Table */}
      <Card className="glass-card border-0 shadow-lg hover-lift">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Issues ({filteredIssues.length})</CardTitle>
            <Badge variant="secondary">{filteredIssues.length} results</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading issues...</div>
          ) : filteredIssues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No issues found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-muted/50">
                    <TableHead>Shipment ID</TableHead>
                    <TableHead>Issue Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssues.map((issue) => (
                    <TableRow key={issue.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>{issue.shipment?.trackingNumber || issue.shipmentId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(issue.issueType)}>
                          {getTypeLabel(issue.issueType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm text-foreground truncate" title={issue.description}>
                          {issue.description}
                        </p>
                      </TableCell>
                      <TableCell>
                        {getSeverityBadge(issue.aiSeverityScore)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(issue.status)}
                      </TableCell>
                      <TableCell>{issue.reportedByUser?.name || issue.reportedByUser?.email || 'Unknown'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="gap-1 hover-lift"
                          onClick={() => handleViewIssue(issue.id)}
                        >
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

      {/* Issue Detail Dialog */}
      <Dialog open={!!selectedIssueId} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {isLoadingIssue ? (
            <div className="text-center py-8 text-muted-foreground">Loading issue details...</div>
          ) : selectedIssue ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  Issue Details
                </DialogTitle>
                <DialogDescription>
                  Issue ID: {selectedIssue.id}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Issue Summary */}
                <Card className="glass-card border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">Issue Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Issue Type</Label>
                        <div className="mt-1">
                          <Badge className={getTypeColor(selectedIssue.issueType)}>
                            {getTypeLabel(selectedIssue.issueType)}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Current Status</Label>
                        <div className="mt-1">
                          {getStatusBadge(selectedIssue.status)}
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Severity Score</Label>
                        <div className="mt-1">
                          {getSeverityBadge(selectedIssue.aiSeverityScore)}
                          <p className="text-xs text-muted-foreground mt-1">
                            AI-calculated severity based on issue type, keywords, VIP status, and SLA risk
                          </p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Reporter</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedIssue.reportedByUser?.name || selectedIssue.reportedByUser?.email || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <div className="mt-1 p-3 bg-muted rounded-lg">
                        <p className="text-sm">{selectedIssue.description}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Created</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{new Date(selectedIssue.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Last Updated</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{new Date(selectedIssue.updatedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Shipment Details */}
                {selectedIssue.shipment && (
                  <Card className="glass-card border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Associated Shipment
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Tracking Number</Label>
                          <p className="mt-1 font-semibold">{selectedIssue.shipment.trackingNumber}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Shipment Status</Label>
                          <p className="mt-1">{selectedIssue.shipment.currentStatus}</p>
                        </div>
                        {selectedIssue.shipment.customer && (
                          <div>
                            <Label className="text-muted-foreground">Customer</Label>
                            <p className="mt-1">{selectedIssue.shipment.customer.name || selectedIssue.shipment.customer.email}</p>
                          </div>
                        )}
                        {selectedIssue.shipment.serviceLevel && (
                          <div>
                            <Label className="text-muted-foreground">Service Level</Label>
                            <p className="mt-1">{selectedIssue.shipment.serviceLevel}</p>
                          </div>
                        )}
                      </div>
                      {selectedIssue.shipment.lastScanLocation && (
                        <div>
                          <Label className="text-muted-foreground">Last Scan Location</Label>
                          <p className="mt-1">{selectedIssue.shipment.lastScanLocation}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Resolution Notes (if resolved) */}
                {selectedIssue.resolutionNotes && (
                  <Card className="glass-card border-0 shadow-lg border-green-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5 text-green-600" />
                        Resolution Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{selectedIssue.resolutionNotes}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Update Issue Section (for admin/manager/dispatcher) */}
                <Card className="glass-card border-0 shadow-lg border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Update Issue</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="status">Update Status</Label>
                      <select
                        id="status"
                        value={updateStatus || selectedIssue.status}
                        onChange={(e) => setUpdateStatus(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="open">Open</option>
                        <option value="investigating">Investigating</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="resolutionNotes">Resolution Notes</Label>
                      <Textarea
                        id="resolutionNotes"
                        value={updateResolutionNotes || selectedIssue.resolutionNotes || ''}
                        onChange={(e) => setUpdateResolutionNotes(e.target.value)}
                        placeholder="Add resolution notes..."
                        className="mt-1 min-h-[100px]"
                      />
                    </div>
                    <Button 
                      onClick={handleUpdateIssue}
                      disabled={updateIssueMutation.isPending}
                      className="w-full"
                    >
                      {updateIssueMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Issue not found</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
