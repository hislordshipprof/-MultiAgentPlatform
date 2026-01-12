// API Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'driver' | 'dispatcher' | 'manager' | 'admin';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface Shipment {
  id: string;
  trackingNumber: string;
  orderId?: string;
  customerId: string;
  fromAddress: string;
  toAddress: string;
  currentStatus: 'PENDING' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';
  serviceLevel: 'standard' | 'express' | 'same_day';
  promisedDeliveryDate?: string;
  lastScanAt?: string;
  lastScanLocation?: string;
  isVip: boolean;
  slaRiskScore: number;
  createdAt: string;
  updatedAt: string;
  scans?: ShipmentScan[];
  customer?: User;
}

export interface ShipmentScan {
  id: string;
  shipmentId: string;
  scanType: 'pickup' | 'in_transit' | 'arrival' | 'departure' | 'out_for_delivery' | 'delivered' | 'failed';
  location: string;
  timestamp: string;
  notes?: string;
}

export interface Route {
  id: string;
  routeCode: string;
  date: string;
  driverId?: string;
  vehicleId?: string;
  region: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  stops?: RouteStop[];
  driver?: {
    id: string;
    driverCode: string;
    userId: string;
    user?: User;
  };
  vehicle?: {
    id: string;
    vehicleCode: string;
    vehicleType: 'van' | 'truck';
    capacityVolume?: number;
    capacityWeight?: number;
    homeBase?: string;
  };
}

export interface RouteStop {
  id: string;
  routeId: string;
  shipmentId: string;
  sequenceNumber: number;
  plannedEta?: string;
  actualArrival?: string;
  status: 'pending' | 'completed' | 'failed';
  shipment?: Shipment;
}

export interface DeliveryIssue {
  id: string;
  shipmentId: string;
  reportedByUserId: string;
  issueType: 'damaged' | 'missing' | 'wrong_address' | 'missed_delivery' | 'delay' | 'other';
  description: string;
  aiSeverityScore: number;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
  shipment?: Shipment;
  reportedByUser?: User;
}

export interface Escalation {
  shipmentId: string;
  deliveryIssueId?: string;
  logs: EscalationLog[];
  currentStatus: 'active' | 'acknowledged' | 'resolved';
  shipment?: {
    id: string;
    trackingNumber: string;
    currentStatus: string;
  };
}

export interface EscalationLog {
  id: string;
  shipmentId: string;
  deliveryIssueId?: string;
  contactId: string;
  attemptNumber: number;
  eventType: 'triggered' | 'advanced' | 'acknowledged';
  payload: any;
  ackReceived: boolean;
  ackMethod?: string;
  acknowledgedAt?: string;
  createdAt: string;
  contact?: {
    id: string;
    userId: string;
    position: number;
    contactType: string;
    timeoutSeconds: number;
    user?: User;
  };
}

export interface Metric {
  id: string;
  key: string;
  name: string;
  description: string;
  aggregationType: 'ratio' | 'count' | 'avg';
  dimension: 'global' | 'region' | 'route' | 'driver';
  targetValue: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  ownerRole: string;
  isVisibleOnDashboard: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MetricSnapshot {
  id: string;
  metricId: string;
  value: number;
  timeRangeStart: string;
  timeRangeEnd: string;
  computedAt: string;
  breakdown?: any;
}

export interface MetricsOverview {
  onTimeDeliveryRate: number;
  onTimeDeliveryRateBreakdown?: any;
  firstAttemptSuccessRate: number;
  firstAttemptSuccessRateBreakdown?: any;
  openIssuesCount: number;
  openIssuesCountBreakdown?: any;
  slaRiskCount: number;
  slaRiskCountBreakdown?: any;
  computedAt: string;
}

export interface AgentSession {
  id: string;
  userId?: string;
  role: string;
  channel: 'chat' | 'voice';
  linkedShipmentId?: string;
  openAiSessionId?: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'completed' | 'error';
  lastAgentName?: string;
  transcript?: any[];
  outcome?: any;
  user?: User;
  linkedShipment?: Shipment;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  text: string;
  sessionId: string;
  toolCalls?: Array<{
    tool: string;
    id?: string;
    input?: any;
    result?: any;
  }>;
}

export interface VoiceSessionResponse {
  sessionId: string;
  token: string;
  url: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  error?: string;
}
