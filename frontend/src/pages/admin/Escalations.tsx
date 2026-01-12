import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Activity, AlertTriangle, CheckCircle2, Clock, Phone, Mail, User, ArrowRight, Package } from 'lucide-react'
import { useState } from 'react'
import { useEscalations, useAcknowledgeEscalation } from '../../hooks/api/useEscalations'
import { useEscalationsWebSocket } from '../../hooks/useWebSocket'
import { useQueryClient } from '@tanstack/react-query'
import type { WebSocketEventData } from '../../services/websocket'

export default function Escalations() {
  const queryClient = useQueryClient()
  const [acknowledgingShipmentId, setAcknowledgingShipmentId] = useState<string | null>(null)
  const [ackMethod, setAckMethod] = useState<string>('dashboard')
  const [ackNotes, setAckNotes] = useState<string>('')
  
  // Fetch escalations
  const { data: escalations = [], isLoading, error } = useEscalations()

  // Acknowledge escalation mutation
  const acknowledgeMutation = useAcknowledgeEscalation()

  // Subscribe to escalations updates via WebSocket
  useEscalationsWebSocket((_event, _data: WebSocketEventData) => {
    queryClient.invalidateQueries({ queryKey: ['escalations'] })
  })

  const handleAcknowledgeClick = (shipmentId: string) => {
    setAcknowledgingShipmentId(shipmentId)
    setAckMethod('dashboard')
    setAckNotes('')
  }

  const handleAcknowledgeConfirm = async () => {
    if (!acknowledgingShipmentId) return

    try {
      await acknowledgeMutation.mutateAsync({
        shipmentId: acknowledgingShipmentId,
        method: ackMethod,
        notes: ackNotes || undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['escalations'] })
      setAcknowledgingShipmentId(null)
      setAckMethod('dashboard')
      setAckNotes('')
    } catch (error: any) {
      console.error('Failed to acknowledge escalation:', error)
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to acknowledge escalation. Please try again.'
      alert(errorMessage)
    }
  }

  const handleCloseAcknowledgeDialog = () => {
    setAcknowledgingShipmentId(null)
    setAckMethod('dashboard')
    setAckNotes('')
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active':
        return <Badge className="bg-red-100 text-red-700 border-red-300 animate-pulse">Active</Badge>
      case 'acknowledged':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Acknowledged</Badge>
      case 'resolved':
        return <Badge className="bg-green-100 text-green-700 border-green-300">Resolved</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getContactIcon = (type: string) => {
    switch(type) {
      case 'phone':
        return <Phone className="h-4 w-4" />
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'sms':
        return <Mail className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="glass-card border-0 shadow-lg border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">Error loading escalations. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeEscalations = escalations.filter(e => e.currentStatus === 'active')
  const acknowledgedEscalations = escalations.filter(e => e.currentStatus === 'acknowledged')
  const resolvedEscalations = escalations.filter(e => e.currentStatus === 'resolved')

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card border-0 shadow-lg hover-lift border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Active Escalations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {activeEscalations.length}
            </div>
            <p className="text-xs text-red-500 mt-1">Requires attention</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg hover-lift border-yellow-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acknowledged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {acknowledgedEscalations.length}
            </div>
            <p className="text-xs text-yellow-500 mt-1">Awaiting resolution</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg hover-lift border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {resolvedEscalations.length}
            </div>
            <p className="text-xs text-green-500 mt-1">Resolved</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg hover-lift">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Escalations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{escalations.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Escalations List */}
      {isLoading ? (
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">Loading escalations...</div>
          </CardContent>
        </Card>
      ) : escalations.length === 0 ? (
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">No escalations found.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {escalations.map((escalation) => {
            const logs = escalation.logs || []
            const currentLevel = logs.length > 0 ? logs[logs.length - 1]?.attemptNumber || 1 : 1
            const totalLevels = logs.length > 0 ? Math.max(...logs.map(l => l.attemptNumber)) : 1
            
            return (
              <Card key={escalation.shipmentId} className="glass-card border-0 shadow-lg hover-lift">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        escalation.currentStatus === 'active' 
                          ? 'bg-red-100 text-red-600' 
                          : escalation.currentStatus === 'acknowledged'
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-green-100 text-green-600'
                      }`}>
                        <Activity className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          Escalation for {escalation.shipment?.trackingNumber || escalation.shipmentId}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {logs[0]?.payload?.reason || 'Escalation triggered'}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(escalation.currentStatus)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Escalation Ladder */}
                    <div>
                      <CardTitle className="text-sm mb-3 flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-primary" />
                        Escalation Ladder (Level {currentLevel}/{totalLevels})
                      </CardTitle>
                      <div className="space-y-3">
                        {logs.map((log, index) => {
                          const contact = log.contact
                          if (!contact) return null
                          
                          return (
                            <div
                              key={log.id}
                              className={`
                                flex items-center gap-4 p-4 rounded-lg border-2 transition-all duration-200
                                ${log.ackReceived 
                                  ? 'border-green-300 bg-green-50' 
                                  : log.eventType === 'triggered' || log.eventType === 'advanced'
                                  ? 'border-blue-300 bg-blue-50'
                                  : index === currentLevel - 1 && escalation.currentStatus === 'active'
                                  ? 'border-red-300 bg-red-50 animate-pulse'
                                  : 'border-gray-200 bg-gray-50'
                                }
                              `}
                            >
                              <div className={`
                                flex items-center justify-center w-10 h-10 rounded-full border-2 font-semibold
                                ${log.ackReceived 
                                  ? 'bg-green-100 border-green-500 text-green-700' 
                                  : log.eventType === 'triggered' || log.eventType === 'advanced'
                                  ? 'bg-blue-100 border-blue-500 text-blue-700'
                                  : 'bg-gray-100 border-gray-300 text-gray-500'
                                }
                              `}>
                                {log.attemptNumber}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`
                                    p-1 rounded
                                    ${log.ackReceived 
                                      ? 'bg-green-100 text-green-600' 
                                      : log.eventType === 'triggered' || log.eventType === 'advanced'
                                      ? 'bg-blue-100 text-blue-600'
                                      : 'bg-gray-100 text-gray-400'
                                    }
                                  `}>
                                    {getContactIcon(contact.contactType)}
                                  </div>
                                  <p className="font-semibold text-foreground">{contact.user?.name || 'Unknown'}</p>
                                  {log.ackReceived && (
                                    <Badge className="bg-green-100 text-green-700 border-green-300 text-xs gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Acknowledged
                                    </Badge>
                                  )}
                                </div>
                                {log.acknowledgedAt && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Acknowledged: {new Date(log.acknowledgedAt).toLocaleString()}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(log.createdAt).toLocaleString()}
                                </p>
                              </div>
                              {index === currentLevel - 1 && escalation.currentStatus === 'active' && (
                                <Button size="sm" variant="destructive" className="gap-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  Current Level
                                </Button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Escalation Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Triggered</p>
                        {logs[0]?.createdAt && (
                          <p className="text-sm font-semibold flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {new Date(logs[0].createdAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      {logs.find(l => l.ackReceived) && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Acknowledged By</p>
                          {logs.find(l => l.ackReceived)?.ackMethod && (
                            <p className="text-sm font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              {logs.find(l => l.ackReceived)?.ackMethod}
                            </p>
                          )}
                        </div>
                      )}
                      <div>
                        {escalation.currentStatus === 'active' && (
                          <Button 
                            className="w-full gap-2"
                            onClick={() => handleAcknowledgeClick(escalation.shipmentId)}
                            disabled={acknowledgeMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {acknowledgeMutation.isPending ? 'Acknowledging...' : 'Acknowledge Escalation'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Acknowledge Escalation Dialog */}
      <Dialog open={!!acknowledgingShipmentId} onOpenChange={handleCloseAcknowledgeDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Acknowledge Escalation
            </DialogTitle>
            <DialogDescription>
              Select the acknowledgment method and add any notes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ackMethod">Acknowledgment Method</Label>
              <select
                id="ackMethod"
                value={ackMethod}
                onChange={(e) => setAckMethod(e.target.value)}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="dashboard">Dashboard</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="sms">SMS</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ackNotes">Notes (Optional)</Label>
              <Textarea
                id="ackNotes"
                placeholder="Add acknowledgment notes..."
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={handleCloseAcknowledgeDialog}>
                Cancel
              </Button>
              <Button 
                onClick={handleAcknowledgeConfirm}
                disabled={acknowledgeMutation.isPending}
              >
                {acknowledgeMutation.isPending ? 'Acknowledging...' : 'Acknowledge'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
