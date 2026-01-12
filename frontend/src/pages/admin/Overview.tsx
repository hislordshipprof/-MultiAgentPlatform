import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Package, Clock, Activity } from 'lucide-react'
import { useMetricsOverview, useMetricSnapshots } from '../../hooks/api/useMetrics'
import { useIssues } from '../../hooks/api/useIssues'
import { useMetricsWebSocket } from '../../hooks/useWebSocket'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useMemo } from 'react'
import type { WebSocketEventData } from '../../services/websocket'

export default function Overview() {
  const queryClient = useQueryClient()
  const [recentActivity, setRecentActivity] = useState<Array<{
    id: number;
    type: string;
    message: string;
    time: string;
    icon: any;
    priority?: string;
  }>>([])

  // Fetch metrics overview
  const { data: metrics, isLoading, error } = useMetricsOverview()

  // Fetch critical issues count
  const { data: criticalIssues = [] } = useIssues({ 
    severity: 'critical', 
    status: 'all' 
  })

  // Fetch previous period snapshots for period-over-period comparison
  // Get snapshots from last 30 days for comparison
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  // Get snapshots for on-time delivery rate metric (assuming it has key 'on_time_delivery_rate')
  const { data: allSnapshots = [] } = useMetricSnapshots({
    startDate: thirtyDaysAgo.toISOString()
  })

  // Calculate period-over-period changes from snapshots
  const calculatePeriodChange = (currentValue: number, metricKey: string): { change: string; trend: 'up' | 'down' } => {
    // Find snapshots for this metric key
    const metricSnapshots = allSnapshots.filter((s: any) => s.metric?.key === metricKey)
    
    if (metricSnapshots.length < 2) {
      // Not enough data for comparison
      return { change: '0%', trend: 'up' }
    }

    // Sort by date (most recent first)
    const sorted = metricSnapshots.sort((a: any, b: any) => 
      new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime()
    )
    
    const previousValue = sorted[1]?.value || 0
    const changeValue = currentValue - previousValue
    const changePercent = previousValue > 0 
      ? ((changeValue / previousValue) * 100).toFixed(1)
      : '0.0'
    
    return {
      change: `${changeValue >= 0 ? '+' : ''}${changePercent}%`,
      trend: changeValue >= 0 ? 'up' : 'down'
    }
  }

  // WebSocket subscription for metrics updates
  useMetricsWebSocket((event, _data: WebSocketEventData) => {
    if (event === 'metrics.snapshot.created') {
      queryClient.invalidateQueries({ queryKey: ['metrics', 'overview'] })
      queryClient.invalidateQueries({ queryKey: ['metrics', 'snapshots'] })
      
      // Add to recent activity
      setRecentActivity(prev => [{
        id: Date.now(),
        type: 'metrics',
        message: 'New metrics snapshot generated',
        time: 'Just now',
        icon: Activity,
      }, ...prev.slice(0, 9)])
    }
  })

  // Format metrics data for display with period-over-period changes
  const kpis = useMemo(() => {
    if (!metrics) return []

    // Calculate period changes for each metric
    const onTimeChange = calculatePeriodChange(metrics.onTimeDeliveryRate, 'on_time_delivery_rate')
    const firstAttemptChange = calculatePeriodChange(metrics.firstAttemptSuccessRate, 'first_attempt_success_rate')
    
    // Calculate open issues change (compare current count with previous snapshot)
    const openIssuesSnapshots = allSnapshots.filter((s: any) => s.metric?.key === 'open_issues_count')
    const sortedOpenIssues = openIssuesSnapshots.sort((a: any, b: any) => 
      new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime()
    )
    const previousOpenIssues = sortedOpenIssues.length > 1 ? sortedOpenIssues[1]?.value || 0 : metrics.openIssuesCount
    const openIssuesChange = metrics.openIssuesCount - previousOpenIssues

    // Calculate SLA risk change
    const slaRiskSnapshots = allSnapshots.filter((s: any) => s.metric?.key === 'sla_risk_count')
    const sortedSlaRisk = slaRiskSnapshots.sort((a: any, b: any) => 
      new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime()
    )
    const previousSlaRisk = sortedSlaRisk.length > 1 ? sortedSlaRisk[1]?.value || 0 : metrics.slaRiskCount
    const slaRiskChange = metrics.slaRiskCount - previousSlaRisk

    // Get critical issues count (severity >= 0.8)
    const criticalCount = criticalIssues.filter(issue => issue.aiSeverityScore >= 0.8).length

    return [
      {
        title: "On-Time Delivery Rate",
        value: `${(metrics.onTimeDeliveryRate * 100).toFixed(1)}%`,
        change: onTimeChange.change,
        trend: onTimeChange.trend,
        target: "95%",
        status: metrics.onTimeDeliveryRate >= 0.95 ? "success" : "warning"
      },
      {
        title: "First-Attempt Success",
        value: `${(metrics.firstAttemptSuccessRate * 100).toFixed(1)}%`,
        change: firstAttemptChange.change,
        trend: firstAttemptChange.trend,
        target: "90%",
        status: metrics.firstAttemptSuccessRate >= 0.90 ? "success" : "warning"
      },
      {
        title: "Open Issues",
        value: metrics.openIssuesCount.toString(),
        change: `${openIssuesChange >= 0 ? '+' : ''}${openIssuesChange}`,
        trend: openIssuesChange <= 0 ? "down" as const : "up" as const,
        critical: criticalCount,
        status: "info" as const
      },
      {
        title: "SLA-Risk Count",
        value: metrics.slaRiskCount.toString(),
        change: `${slaRiskChange >= 0 ? '+' : ''}${slaRiskChange}`,
        trend: slaRiskChange <= 0 ? "down" as const : "up" as const,
        threshold: 10,
        status: metrics.slaRiskCount > 10 ? "warning" as const : "success" as const
      }
    ]
  }, [metrics, allSnapshots, criticalIssues])

  // Load initial recent activity from local storage or generate placeholder
  useEffect(() => {
    if (recentActivity.length === 0) {
      setRecentActivity([
        { id: 1, type: "shipment", message: "Loading recent activity...", time: "Just now", icon: Package },
      ])
    }
  }, [])

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="glass-card border-0 shadow-lg border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">Error loading metrics. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="glass-card border-0 shadow-lg hover-lift transition-all duration-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-muted-foreground">-</div>
              </CardContent>
            </Card>
          ))
        ) : (
          kpis.map((kpi, index) => (
            <Card key={index} className="glass-card border-0 shadow-lg hover-lift transition-all duration-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                  {kpi.title}
                  {kpi.trend === "up" ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">{kpi.value}</span>
                    <Badge 
                      variant={kpi.trend === "up" ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {kpi.change}
                    </Badge>
                  </div>
                  {kpi.target && (
                    <p className="text-xs text-muted-foreground">
                      Target: <span className="font-medium">{kpi.target}</span>
                    </p>
                  )}
                  {kpi.critical && (
                    <p className="text-xs text-red-500 font-medium">
                      {kpi.critical} critical
                    </p>
                  )}
                  {kpi.threshold !== undefined && (
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div 
                        className={`h-2 rounded-full ${
                          parseInt(kpi.value) > kpi.threshold 
                            ? 'bg-red-500' 
                            : 'bg-teal-500'
                        }`}
                        style={{ width: `${Math.min((parseInt(kpi.value) / (kpi.threshold * 1.5)) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* On-Time Delivery Rate Trend */}
        <Card className="glass-card border-0 shadow-lg hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              On-Time Delivery Rate Trend
            </CardTitle>
            <CardDescription>Performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Loading trend data...
              </div>
            ) : metrics ? (
              <div className="h-[250px] flex flex-col justify-center items-center">
                <div className="text-4xl font-bold text-foreground mb-2">
                  {(metrics.onTimeDeliveryRate * 100).toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">
                  Current on-time delivery rate
                </p>
                {metrics.onTimeDeliveryRateBreakdown && (
                  <div className="mt-6 w-full space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-3">Breakdown by Region</p>
                    {Object.entries(metrics.onTimeDeliveryRateBreakdown as Record<string, number>).map(([region, value]) => {
                      const percentage = typeof value === 'number' && value <= 1 ? value * 100 : value
                      return (
                        <div key={region} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{region}</span>
                            <span className="font-semibold text-foreground">{percentage.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-300"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shipment Success Rate */}
        <Card className="glass-card border-0 shadow-lg hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Shipment Success Rate
            </CardTitle>
            <CardDescription>Success vs failed deliveries</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : metrics ? (
              <div className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-foreground">
                    {(metrics.firstAttemptSuccessRate * 100).toFixed(0)}%
                  </span>
                  <Badge className="bg-green-100 text-green-700 border-green-300">
                    ↑8%
                  </Badge>
                </div>
                
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Success</span>
                    <span className="font-semibold text-green-600">
                      {(metrics.firstAttemptSuccessRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-6 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-end pr-2"
                      style={{ width: `${metrics.firstAttemptSuccessRate * 100}%` }}
                    >
                      <span className="text-xs font-semibold text-white">
                        {(metrics.firstAttemptSuccessRate * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded bg-green-500"></div>
                      <span className="text-xs text-muted-foreground">
                        Success ({(metrics.firstAttemptSuccessRate * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded bg-gray-300"></div>
                      <span className="text-xs text-muted-foreground">
                        Not yet ({((1 - metrics.firstAttemptSuccessRate) * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="glass-card border-0 shadow-lg hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest updates across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No recent activity</div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => {
                const Icon = activity.icon
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-all duration-200 hover-lift"
                  >
                    <div className={`p-2 rounded-lg ${
                      activity.priority === 'critical' 
                        ? 'bg-red-100 text-red-600' 
                        : activity.priority === 'high'
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{activity.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                    </div>
                    {activity.priority && (
                      <Badge variant={activity.priority === 'critical' ? 'destructive' : 'secondary'}>
                        {activity.priority}
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
