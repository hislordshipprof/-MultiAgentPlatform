import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Mic, Send, Search, Package, MapPin, Clock, AlertCircle, CheckCircle2, Truck, PackageCheck, MessageSquare, Edit, AlertTriangle } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useShipments, useTrackShipment, useShipmentTimeline, useShipment } from '../../hooks/api/useShipments'
import { useShipmentIssues } from '../../hooks/api/useIssues'
import { useChat } from '../../hooks/api/useAi'
import { useShipmentWebSocket } from '../../hooks/useWebSocket'
import { useAuth } from '../../hooks/useAuth'
import type { WebSocketEventData } from '../../services/websocket'
import { useQueryClient } from '@tanstack/react-query'
import { useVoice, speakText, stopSpeaking } from '../../hooks/useVoice'

export default function CustomerDashboard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [trackingNumber, setTrackingNumber] = useState('')
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<{role: 'user' | 'agent', text: string, timestamp: Date}[]>([
    { role: 'agent', text: 'Hello! How can I help you with your shipment today?', timestamp: new Date() }
  ])
  const [input, setInput] = useState('')
  const [liveTranscription, setLiveTranscription] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Fetch customer shipments
  const { data: shipments = [], isLoading: isLoadingShipments, error: shipmentsError } = useShipments()
  
  // Track shipment by tracking number
  const { data: trackedShipment, isLoading: isLoadingTracked } = useTrackShipment(trackingNumber || null)
  
  // Get selected shipment details
  const { data: selectedShipment, isLoading: isLoadingSelected } = useShipment(selectedShipmentId)
  
  // Get shipment timeline
  const { data: timeline = [] } = useShipmentTimeline(selectedShipmentId)

  // Filter shipments for current customer (backend should handle this, but filter on frontend as backup)
  const customerShipments = shipments.filter(s => 
    user?.role === 'customer' ? s.customerId === user?.id : true
  )

  // Get issues for selected shipment (only if shipment belongs to customer)
  const shipmentBelongsToCustomer = selectedShipmentId 
    ? customerShipments.some(s => s.id === selectedShipmentId) || 
      (trackedShipment && trackedShipment.customerId === user?.id)
    : false
  
  const { data: shipmentIssues, error: issuesError } = useShipmentIssues(
    selectedShipmentId && shipmentBelongsToCustomer ? selectedShipmentId : null
  )
  
  // Only count issues if query was successful (ignore 403 errors)
  const shipmentHasIssues = shipmentIssues && !issuesError
    ? shipmentIssues.filter(issue => 
        issue.status === 'open' || issue.status === 'investigating'
      ).length > 0
    : false

  // Chat mutation
  const chatMutation = useChat()

  // Create a ref to store stopListening function (will be set by useVoice hook)
  const stopListeningRef = useRef<(() => void) | null>(null)

  // Voice hook - define callback first, but use ref for stopListening
  const handleVoiceTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return
    
    // Stop listening immediately to prevent interruptions
    if (stopListeningRef.current) {
      stopListeningRef.current()
    }
    setLiveTranscription('')
    
    // Add user message to chat
    const userMessage = { role: 'user' as const, text: text.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    
    try {
      const response = await chatMutation.mutateAsync({
        message: text.trim(),
        sessionId: sessionId || undefined,
        linkedShipmentId: selectedShipmentId || undefined,
      })
      
      if (response.sessionId) {
        setSessionId(response.sessionId)
      }
      
      const agentMessage = {
        role: 'agent' as const,
        text: response.text,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, agentMessage])
      
      // Speak the response using TTS
      // isSpeaking is set when TTS actually starts (onStart callback)
      speakText(
        response.text,
        () => {
          // onStart: TTS has actually started speaking
          setIsSpeaking(true)
        },
        () => {
          // onEnd: TTS has finished speaking
          setIsSpeaking(false)
          // Mic stays stopped - user can click to restart when ready
        }
      )
    } catch (error) {
      console.error('Voice chat error:', error)
      const errorMessage = {
        role: 'agent' as const,
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      // Mic stays stopped after error - user can click to restart
    }
  }, [sessionId, selectedShipmentId, chatMutation])

  const {
    isListening,
    isSupported: isVoiceSupported,
    startListening,
    stopListening,
    getInterimTranscript,
  } = useVoice({
    onTranscript: handleVoiceTranscript,
    onError: (error) => {
      console.error('Voice error:', error)
      // Only show critical errors to user (network, permission issues)
      // Don't show recoverable errors like 'no-speech' or 'aborted'
      if (error.message.includes('network') || error.message.includes('not-allowed') || error.message.includes('not available')) {
        setMessages(prev => [...prev, {
          role: 'agent',
          text: `${error.message}. Please check your microphone permissions or try typing instead.`,
          timestamp: new Date()
        }])
      }
      // For other errors, just log them - don't interrupt user flow
    }
  })

  // Store stopListening in ref for use in handleVoiceTranscript
  useEffect(() => {
    stopListeningRef.current = stopListening
  }, [stopListening])

  // Update live transcription
  useEffect(() => {
    if (isListening) {
      const interval = setInterval(() => {
        const interim = getInterimTranscript()
        setLiveTranscription(interim)
      }, 100)
      return () => clearInterval(interval)
    } else {
      setLiveTranscription('')
    }
  }, [isListening, getInterimTranscript])

  // Stop listening if processing starts (but allow user to interrupt during speaking)
  useEffect(() => {
    if (chatMutation.isPending && isListening) {
      stopListening()
    }
  }, [chatMutation.isPending, isListening, stopListening])

  // Stop TTS if user starts listening (user wants to interrupt)
  useEffect(() => {
    if (isListening && isSpeaking) {
      stopSpeaking()
      setIsSpeaking(false)
    }
  }, [isListening, isSpeaking])

  // Handle voice toggle
  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening()
      stopSpeaking()
    } else {
      // Don't start if processing (but allow during speaking - user can interrupt)
      if (!chatMutation.isPending) {
        // If speaking, stop it first, then start listening
        if (isSpeaking) {
          stopSpeaking()
          setIsSpeaking(false)
        }
        startListening()
      }
    }
  }, [isListening, startListening, stopListening, chatMutation.isPending, isSpeaking])

  // WebSocket subscription for selected shipment
  useShipmentWebSocket(
    selectedShipmentId ? (selectedShipment?.trackingNumber || null) : null,
    (event, _data: WebSocketEventData) => {
      // Invalidate queries on real-time updates
      if (event === 'shipment.scan.created' || event === 'shipment.status.updated') {
        queryClient.invalidateQueries({ queryKey: ['shipments', selectedShipmentId] })
        queryClient.invalidateQueries({ queryKey: ['shipments', selectedShipmentId, 'timeline'] })
        queryClient.invalidateQueries({ queryKey: ['shipments'] })
      }
      // Invalidate issues on issue updates
      if (event === 'issue.created' || event === 'issue.updated') {
        queryClient.invalidateQueries({ queryKey: ['issues', 'shipment', selectedShipmentId] })
        queryClient.invalidateQueries({ queryKey: ['issues'] })
      }
    }
  )

  // Update selected shipment when tracking
  useEffect(() => {
    if (trackedShipment) {
      setSelectedShipmentId(trackedShipment.id)
      setTrackingNumber('')
      setIsModalOpen(true)
    }
  }, [trackedShipment])

  // Open modal when shipment is selected
  const handleShipmentClick = (shipmentId: string) => {
    setSelectedShipmentId(shipmentId)
    setIsModalOpen(true)
  }

  // Quick action: Report Issue
  const handleQuickReportIssue = () => {
    if (selectedShipmentData) {
      const message = `I want to report an issue with my shipment ${selectedShipmentData.trackingNumber}.`
      setInput(message)
      setIsModalOpen(false)
      // Focus on input after a brief delay
      setTimeout(() => {
        const inputElement = document.querySelector('input[placeholder*="Type a message"]') as HTMLInputElement
        inputElement?.focus()
      }, 100)
    }
  }

  // Quick action: Request Delivery Change
  const handleQuickRequestChange = () => {
    if (selectedShipmentData) {
      const message = `I want to request a change for my shipment ${selectedShipmentData.trackingNumber}.`
      setInput(message)
      setIsModalOpen(false)
      // Focus on input after a brief delay
      setTimeout(() => {
        const inputElement = document.querySelector('input[placeholder*="Type a message"]') as HTMLInputElement
        inputElement?.focus()
      }, 100)
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const userMessage = { role: 'user' as const, text: input, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    const messageText = input
    setInput('')
    
    try {
      const response = await chatMutation.mutateAsync({
        message: messageText,
        sessionId: sessionId || undefined,
        linkedShipmentId: selectedShipmentId || undefined,
      })
      
      if (response.sessionId) {
        setSessionId(response.sessionId)
      }
      
      const agentMessage = {
        role: 'agent' as const,
        text: response.text,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, agentMessage])
      
      // Don't speak text chat responses - TTS only for voice mode
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'agent',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }])
    }
  }

  const handleTrack = () => {
    if (!trackingNumber.trim()) return
    // TrackShipment hook will automatically fetch when trackingNumber changes
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'delivered': return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'out_for_delivery': return <Truck className="h-5 w-5 text-blue-500" />
      case 'in_transit': return <PackageCheck className="h-5 w-5 text-teal-500" />
      default: return <Package className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'delivered': return 'bg-green-100 text-green-700 border-green-300'
      case 'out_for_delivery': return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'in_transit': return 'bg-teal-100 text-teal-700 border-teal-300'
      case 'PENDING': return 'bg-gray-100 text-gray-700 border-gray-300'
      default: return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'PENDING': 'Pending',
      'in_transit': 'In Transit',
      'out_for_delivery': 'Out for Delivery',
      'delivered': 'Delivered',
      'failed': 'Failed',
      'returned': 'Returned',
    }
    return statusMap[status] || status
  }

  // Find selected shipment data
  const selectedShipmentData = selectedShipmentId 
    ? customerShipments.find(s => s.id === selectedShipmentId) || trackedShipment
    : null

  return (
    <div className="space-y-6">
      {/* Tracking Input Section */}
      <Card className="glass-card border-0 shadow-lg hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Track Your Shipment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter tracking number (e.g., TRK-173829-1)"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
              className="flex-1"
            />
            <Button onClick={handleTrack} disabled={isLoadingTracked || !trackingNumber.trim()}>
              <Search className="h-4 w-4 mr-2" />
              {isLoadingTracked ? 'Tracking...' : 'Track'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {shipmentsError && (
        <Card className="glass-card border-0 shadow-lg border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">Error loading shipments. Please try again later.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Shipment List - Left Column */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-card border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                My Shipments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingShipments ? (
                <div className="text-center py-8 text-muted-foreground">Loading shipments...</div>
              ) : customerShipments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No shipments found.</div>
              ) : (
                <div className="space-y-3">
                  {customerShipments.map((shipment) => (
                    <div
                      key={shipment.id}
                      onClick={() => handleShipmentClick(shipment.id)}
                      className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover-lift
                        ${selectedShipmentId === shipment.id 
                          ? 'border-primary bg-primary/5 shadow-md' 
                          : 'border-border bg-background hover:border-primary/50'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(shipment.currentStatus)}
                          <div>
                            <p className="font-semibold text-foreground">{shipment.trackingNumber}</p>
                            <p className="text-sm text-muted-foreground">{shipment.toAddress}</p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(shipment.currentStatus)}>
                          {getStatusLabel(shipment.currentStatus)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
                        {shipment.lastScanLocation && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{shipment.lastScanLocation}</span>
                          </div>
                        )}
                        {shipment.promisedDeliveryDate && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>ETA: {new Date(shipment.promisedDeliveryDate).toLocaleDateString()}</span>
                          </div>
                        )}
                        {shipmentHasIssues && (
                          <div className="flex items-center gap-1 text-red-500">
                            <AlertCircle className="h-4 w-4" />
                            <span>Issue Reported</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipment Detail Modal */}
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto glass-card border-0 shadow-lg">
              {selectedShipmentData && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Shipment Details: {selectedShipmentData.trackingNumber}
                      </span>
                      <Badge className={getStatusColor(selectedShipmentData.currentStatus)}>
                        {getStatusLabel(selectedShipmentData.currentStatus)}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription>
                      Complete tracking information and quick actions
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 mt-4">
                    {/* Quick Actions */}
                    <div className="flex gap-3 pb-4 border-b border-border">
                      <Button
                        onClick={handleQuickReportIssue}
                        variant="outline"
                        className="flex-1 gap-2"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Report Issue
                      </Button>
                      <Button
                        onClick={handleQuickRequestChange}
                        variant="outline"
                        className="flex-1 gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Request Change
                      </Button>
                    </div>

                    {/* Shipment Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Tracking Number</p>
                        <p className="text-lg font-semibold">{selectedShipmentData.trackingNumber}</p>
                      </div>
                      
                      {selectedShipmentData.lastScanLocation && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Current Location</p>
                          <p className="text-base flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {selectedShipmentData.lastScanLocation}
                          </p>
                        </div>
                      )}
                      
                      {selectedShipmentData.promisedDeliveryDate && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Estimated Delivery</p>
                          <p className="text-base font-medium flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {new Date(selectedShipmentData.promisedDeliveryDate).toLocaleString()}
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Destination</p>
                        <p className="text-base">{selectedShipmentData.toAddress}</p>
                      </div>
                    </div>

                    {/* Active Issues */}
                    {shipmentIssues && shipmentIssues.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-red-500 flex items-center gap-2">
                          <AlertCircle className="h-5 w-5" /> Active Issues
                        </h3>
                        {shipmentIssues.filter(issue => issue.status === 'open' || issue.status === 'investigating').map((issue) => (
                          <div key={issue.id} className="bg-red-50 border border-red-200 p-3 rounded-lg text-red-700">
                            <p className="font-medium">{issue.issueType.replace(/_/g, ' ')}</p>
                            <p className="text-sm">{issue.description}</p>
                            <p className="text-xs text-red-600 mt-1">Status: {issue.status}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Timeline */}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-3">Tracking Timeline</p>
                      {isLoadingSelected ? (
                        <div className="text-sm text-muted-foreground">Loading timeline...</div>
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
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : selectedShipmentData.scans && selectedShipmentData.scans.length > 0 ? (
                        <div className="space-y-4">
                          {selectedShipmentData.scans.map((scan, index) => (
                            <div key={scan.id} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className={`h-3 w-3 rounded-full ${
                                  index === 0 ? 'bg-primary' : 'bg-muted'
                                }`}></div>
                                {index < selectedShipmentData.scans!.length - 1 && (
                                  <div className="w-0.5 h-full bg-border mt-1"></div>
                                )}
                              </div>
                              <div className="flex-1 pb-4">
                                <p className="font-medium text-foreground">{scan.location}</p>
                                <p className="text-sm text-muted-foreground capitalize">{scan.scanType.replace('_', ' ')}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(scan.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No tracking information available.</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Chat + Voice Widget - Right Column */}
        <div className="lg:col-span-1 lg:sticky lg:top-6">
          <Card className="glass-card border-0 shadow-lg flex flex-col" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
            <CardHeader className="border-b border-border/50 flex-shrink-0">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  CallSphere Support
                </span>
                {(isListening || isSpeaking) && (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-muted-foreground">
                      {isListening ? 'Recording' : 'Speaking'}
                    </span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`
                    max-w-[80%] p-3 rounded-2xl transition-all duration-200 hover-lift
                    ${m.role === 'user' 
                      ? 'bg-gradient-to-br from-primary to-teal-500 text-white shadow-lg' 
                      : 'glass-card border border-border/50 text-foreground'
                    }
                  `}>
                    <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {m.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {/* Live transcription display */}
              {liveTranscription && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] p-3 rounded-2xl bg-gradient-to-br from-primary/50 to-teal-500/50 text-white shadow-lg border border-primary/30">
                    <p className="text-sm italic opacity-90">{liveTranscription}</p>
                    <p className="text-xs opacity-70 mt-1">Listening...</p>
                  </div>
                </div>
              )}
              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="glass-card border border-border/50 text-foreground p-3 rounded-2xl">
                    <p className="text-sm">Thinking...</p>
                  </div>
                </div>
              )}
            </CardContent>
            
            <div className="p-4 border-t border-border/50 space-y-2 flex-shrink-0">
              {/* Voice Button */}
              <div className="flex gap-2">
                <Button
                  variant={isListening ? "destructive" : "outline"}
                  size="icon"
                  onClick={handleVoiceToggle}
                  className={isListening ? "animate-pulse" : ""}
                  disabled={!isVoiceSupported || chatMutation.isPending}
                  title={!isVoiceSupported 
                    ? "Voice not supported in this browser. Please use Chrome, Edge, or Safari." 
                    : chatMutation.isPending
                    ? "Processing your request..."
                    : isListening 
                    ? "Click to stop recording" 
                    : isSpeaking
                    ? "Click to interrupt and start speaking"
                    : "Click to start voice input"}
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !chatMutation.isPending && handleSend()}
                    className="pr-12"
                    disabled={chatMutation.isPending}
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    disabled={!input.trim() || chatMutation.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {isVoiceSupported 
                  ? "Chat or use voice for shipment tracking, issue reporting, or delivery changes"
                  : "Chat for shipment tracking, issue reporting, or delivery changes"}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
