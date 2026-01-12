import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, BarChart3, LineChart, PieChart } from 'lucide-react'
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useMetricDefinitions, useMetricSnapshotsByMetric, useMetricsOverview } from '../../hooks/api/useMetrics'
import { useMetricsWebSocket } from '../../hooks/useWebSocket'
import { useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import type { WebSocketEventData } from '../../services/websocket'

export default function Metrics() {
  const queryClient = useQueryClient()
  
  // Fetch metrics overview for current values
  const { data: metricsOverview } = useMetricsOverview()

  // Fetch metric definitions
  const { data: metrics = [], isLoading: isLoadingMetrics } = useMetricDefinitions()

  // Set default metric to "On-Time Delivery Rate" if available
  const defaultMetric = metrics.find(m => m.key === 'on_time_delivery_rate')
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(defaultMetric?.id || null)

  // Update selected metric when metrics load and default is available
  useEffect(() => {
    if (!selectedMetricId && defaultMetric) {
      setSelectedMetricId(defaultMetric.id)
    }
  }, [metrics, selectedMetricId, defaultMetric])

  // Fetch snapshots for selected metric
  const { data: snapshotsData, isLoading: isLoadingSnapshots } = useMetricSnapshotsByMetric(selectedMetricId)
  const snapshots = snapshotsData || []

  // Subscribe to metrics updates via WebSocket
  useMetricsWebSocket((_event, _data: WebSocketEventData) => {
    queryClient.invalidateQueries({ queryKey: ['metrics', 'snapshots'] })
    if (selectedMetricId) {
      queryClient.invalidateQueries({ queryKey: ['metrics', 'snapshots', selectedMetricId] })
    }
  })

  // Get current value for a metric from overview or latest snapshot
  const getCurrentValue = (metric: typeof metrics[0]): number => {
    // Try to get from overview first (for standard metrics)
    if (metricsOverview) {
      switch (metric.key) {
        case 'on_time_delivery_rate':
          return metricsOverview.onTimeDeliveryRate
        case 'first_attempt_success_rate':
          return metricsOverview.firstAttemptSuccessRate
        case 'open_issues_count':
          return metricsOverview.openIssuesCount
        case 'sla_risk_count':
          return metricsOverview.slaRiskCount
      }
    }
    
    // Fallback to latest snapshot
    const latestSnapshot = snapshots.find(s => s.metricId === metric.id)
    return latestSnapshot?.value || 0
  }

  const getMetricStatus = (metric: typeof metrics[0]) => {
    if (!metric.warningThreshold || !metric.criticalThreshold) {
      return { color: 'gray', label: 'Unknown' }
    }
    
    const currentValue = getCurrentValue(metric)
    
    if (metric.aggregationType === 'count') {
      if (currentValue >= metric.criticalThreshold) {
        return { color: 'red', label: 'Critical' }
      } else if (metric.warningThreshold && currentValue >= metric.warningThreshold) {
        return { color: 'orange', label: 'Warning' }
      } else if (currentValue <= metric.targetValue) {
        return { color: 'green', label: 'On Target' }
      } else {
        return { color: 'yellow', label: 'Above Target' }
      }
    } else {
      // For ratio/avg, compare differently (lower is worse for percentages)
      const currentPercent = currentValue * 100 // Convert to percentage if needed
      if (metric.criticalThreshold && currentPercent <= metric.criticalThreshold) {
        return { color: 'red', label: 'Critical' }
      } else if (metric.warningThreshold && currentPercent <= metric.warningThreshold) {
        return { color: 'orange', label: 'Warning' }
      } else if (currentPercent >= metric.targetValue) {
        return { color: 'green', label: 'On Target' }
      } else {
        return { color: 'yellow', label: 'Below Target' }
      }
    }
  }

  // Get visible metrics for dashboard
  const visibleMetrics = metrics.filter(m => m.isVisibleOnDashboard)

  // Get regional breakdown from overview breakdown data
  const regionalBreakdown = useMemo(() => {
    if (!metricsOverview?.onTimeDeliveryRateBreakdown) {
      return null
    }
    return metricsOverview.onTimeDeliveryRateBreakdown as Record<string, number>
  }, [metricsOverview])

  // Get trend for a metric by comparing latest two snapshots
  const getMetricTrend = (metric: typeof metrics[0]) => {
    const metricSnapshots = snapshots.filter(s => s.metricId === metric.id)
    if (metricSnapshots.length < 2) {
      return { change: '0%', trend: 'up' as const }
    }
    const sorted = [...metricSnapshots].sort((a, b) => 
      new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime()
    )
    const current = sorted[0]?.value || 0
    const previous = sorted[1]?.value || 0
    const change = current - previous
    const percentChange = previous > 0 ? ((change / previous) * 100).toFixed(1) : '0.0'
    
    return {
      change: `${change >= 0 ? '+' : ''}${percentChange}%`,
      trend: change >= 0 ? 'up' as const : 'down' as const
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {isLoadingMetrics ? (
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
        ) : visibleMetrics.length === 0 ? (
          <Card className="glass-card border-0 shadow-lg col-span-full">
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">No metrics configured for dashboard.</div>
            </CardContent>
          </Card>
        ) : (
          visibleMetrics.map((metric) => {
            const status = getMetricStatus(metric)
            const currentValue = getCurrentValue(metric)
            const trend = getMetricTrend(metric)
            const unit = metric.aggregationType === 'ratio' ? '%' : ''
            const displayValue = metric.aggregationType === 'ratio' 
              ? currentValue * 100 
              : currentValue
            
            return (
              <Card key={metric.id} className="glass-card border-0 shadow-lg hover-lift transition-all duration-200 flex flex-col">
                <CardHeader className="pb-3 flex-shrink-0">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center justify-between gap-2">
                    <span className="truncate">{metric.name}</span>
                    {trend.trend === 'up' ? (
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                        {displayValue.toFixed(metric.aggregationType === 'ratio' ? 1 : 0)}{unit}
                      </span>
                      <Badge 
                        variant={trend.trend === 'up' ? 'default' : 'destructive'} 
                        className="text-xs flex-shrink-0"
                      >
                        {trend.change}
                      </Badge>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                        <span className="text-xs text-muted-foreground">Target: {metric.targetValue}{unit}</span>
                        <Badge 
                          className={`
                            text-xs w-fit
                            ${status.color === 'red' ? 'bg-red-100 text-red-700 border-red-300' : ''}
                            ${status.color === 'orange' ? 'bg-orange-100 text-orange-700 border-orange-300' : ''}
                            ${status.color === 'green' ? 'bg-green-100 text-green-700 border-green-300' : ''}
                            ${status.color === 'yellow' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : ''}
                          `}
                        >
                          {status.label}
                        </Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            status.color === 'red' ? 'bg-red-500' : 
                            status.color === 'orange' ? 'bg-orange-500' : 
                            status.color === 'green' ? 'bg-green-500' : 
                            'bg-yellow-500'
                          }`}
                          style={{ width: `${Math.min((currentValue / (metric.targetValue * 1.1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Metric Trend Chart */}
        <Card className="glass-card border-0 shadow-lg hover-lift flex flex-col">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <LineChart className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <span className="truncate">
                {selectedMetricId 
                  ? `${metrics.find(m => m.id === selectedMetricId)?.name || 'Metric'} Trend`
                  : 'Metric Trend Chart'
                }
              </span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {selectedMetricId 
                ? `Historical performance over time for ${metrics.find(m => m.id === selectedMetricId)?.name || 'selected metric'}`
                : 'Select a metric to view its historical trend'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            {/* Metric Selection */}
            <div className="mb-3 sm:mb-4 flex-shrink-0">
              <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 block">
                Select Metric for Chart
              </label>
              <select
                value={selectedMetricId || ''}
                onChange={(e) => setSelectedMetricId(e.target.value || null)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">-- Select a metric --</option>
                {metrics.map((metric) => (
                  <option key={metric.id} value={metric.id}>
                    {metric.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-h-0 flex items-center justify-center">
              {isLoadingSnapshots ? (
                <div className="h-[200px] sm:h-[250px] lg:h-[300px] w-full flex items-center justify-center text-muted-foreground">
                  Loading chart data...
                </div>
              ) : !selectedMetricId ? (
                <div className="h-[200px] sm:h-[250px] lg:h-[300px] w-full flex items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
                  <p className="text-sm text-center px-4">Please select a metric to view its trend chart</p>
                </div>
              ) : snapshots.length === 0 ? (
                <div className="h-[200px] sm:h-[250px] lg:h-[300px] w-full flex items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
                  <p className="text-sm text-center px-4">No snapshot data available for this metric</p>
                </div>
            ) : (() => {
              const selectedMetric = metrics.find(m => m.id === selectedMetricId)
              if (!selectedMetric) return null

              // Sort snapshots chronologically (oldest first)
              const sortedSnapshots = [...snapshots].sort((a, b) => 
                new Date(a.computedAt).getTime() - new Date(b.computedAt).getTime()
              )

              // Take last 30 snapshots for display (or all if less than 30)
              const displaySnapshots = sortedSnapshots.slice(-30)
              
              // Format date for display
              const formatDate = (date: Date) => {
                const now = new Date()
                const diffTime = now.getTime() - date.getTime()
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
                
                if (diffDays === 0) return 'Today'
                if (diffDays === 1) return 'Yesterday'
                if (diffDays < 7) return `${diffDays}d ago`
                if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
                
                // For older dates, show month and day
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }

              // Prepare chart data for Recharts
              const chartData = displaySnapshots.map(snapshot => {
                const value = selectedMetric.aggregationType === 'ratio' ? snapshot.value * 100 : snapshot.value
                const date = new Date(snapshot.computedAt)
                return {
                  date: formatDate(date),
                  fullDate: date.toISOString(),
                  value: Number(value.toFixed(selectedMetric.aggregationType === 'ratio' ? 1 : 0)),
                  timestamp: date.getTime()
                }
              })

              // Calculate Y-axis domain with some padding
              const values = chartData.map(d => d.value)
              const maxValue = Math.max(...values, selectedMetric.targetValue || 0, selectedMetric.warningThreshold || 0, selectedMetric.criticalThreshold || 0, 0)
              const minValue = Math.min(...values, 0)
              const padding = (maxValue - minValue) * 0.1 || 10
              
              const unit = selectedMetric.aggregationType === 'ratio' ? '%' : ''

              return (
                <div className="w-full flex flex-col">
                  <div className="w-full" style={{ height: '250px', minHeight: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 50 }}
                      >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        width={50}
                        domain={[Math.max(0, minValue - padding), maxValue + padding]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          padding: '8px 12px'
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: '4px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number | undefined) => {
                          if (value === undefined) return ['N/A', 'Value']
                          return [`${value.toFixed(selectedMetric.aggregationType === 'ratio' ? 1 : 0)}${unit}`, 'Value']
                        }}
                        labelFormatter={(label) => {
                          const dataPoint = chartData.find(d => d.date === label)
                          if (dataPoint) {
                            return new Date(dataPoint.fullDate).toLocaleString()
                          }
                          return label
                        }}
                      />
                      
                      {/* Reference lines for thresholds */}
                      {selectedMetric.targetValue && (
                        <ReferenceLine 
                          y={selectedMetric.targetValue} 
                          stroke="#10b981" 
                          strokeDasharray="5 5" 
                          strokeWidth={2}
                          label={{ value: `Target: ${selectedMetric.targetValue}${unit}`, position: 'right', fill: '#10b981', fontSize: 11 }}
                        />
                      )}
                      {selectedMetric.warningThreshold && (
                        <ReferenceLine 
                          y={selectedMetric.warningThreshold} 
                          stroke="#f59e0b" 
                          strokeDasharray="3 3" 
                          strokeWidth={1.5}
                          label={{ value: `Warning: ${selectedMetric.warningThreshold}${unit}`, position: 'right', fill: '#f59e0b', fontSize: 10 }}
                        />
                      )}
                      {selectedMetric.criticalThreshold && (
                        <ReferenceLine 
                          y={selectedMetric.criticalThreshold} 
                          stroke="#ef4444" 
                          strokeDasharray="3 3" 
                          strokeWidth={1.5}
                          label={{ value: `Critical: ${selectedMetric.criticalThreshold}${unit}`, position: 'right', fill: '#ef4444', fontSize: 10 }}
                        />
                      )}
                      
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={{ fill: 'hsl(var(--primary))', r: 3, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--primary))', fill: 'hsl(var(--primary))' }}
                        name="Value"
                      />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Chart Legend */}
                  <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-4 text-xs">
                    {selectedMetric.targetValue && (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5 bg-green-500 border-dashed border-t border-green-500"></div>
                        <span className="text-muted-foreground">Target: {selectedMetric.targetValue}{unit}</span>
                      </div>
                    )}
                    {selectedMetric.warningThreshold && (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5 bg-amber-500 border-dashed border-t border-amber-500"></div>
                        <span className="text-muted-foreground">Warning: {selectedMetric.warningThreshold}{unit}</span>
                      </div>
                    )}
                    {selectedMetric.criticalThreshold && (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5 bg-red-500 border-dashed border-t border-red-500"></div>
                        <span className="text-muted-foreground">Critical: {selectedMetric.criticalThreshold}{unit}</span>
                      </div>
                    )}
                  </div>

                  {/* Latest Snapshot Info */}
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-foreground">Latest Snapshot</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {displaySnapshots[displaySnapshots.length - 1]?.computedAt 
                            ? new Date(displaySnapshots[displaySnapshots.length - 1].computedAt).toLocaleString()
                            : 'No data'
                          }
                        </p>
                      </div>
                      {displaySnapshots.length >= 2 && (() => {
                        const trend = getMetricTrend(selectedMetric)
                        return (
                          <Badge 
                            className={`text-xs flex-shrink-0 ${trend.trend === 'up' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}
                          >
                            {trend.change}
                          </Badge>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )
            })()}
            </div>
          </CardContent>
        </Card>

        {/* Metrics Overview */}
        <Card className="glass-card border-0 shadow-lg hover-lift flex flex-col">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <PieChart className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              Metrics Overview
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">All configured metrics</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <div className="space-y-3 sm:space-y-4">
              {isLoadingMetrics ? (
                <div className="text-center py-8 text-muted-foreground">Loading metrics...</div>
              ) : metrics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No metrics configured.</div>
              ) : (
                metrics.map((metric) => {
                  const status = getMetricStatus(metric)
                  return (
                    <div key={metric.id} className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                        <span className="text-xs sm:text-sm font-medium text-foreground truncate">{metric.name}</span>
                        <Badge 
                          className={`
                            text-xs w-fit flex-shrink-0
                            ${status.color === 'red' ? 'bg-red-100 text-red-700 border-red-300' : ''}
                            ${status.color === 'orange' ? 'bg-orange-100 text-orange-700 border-orange-300' : ''}
                            ${status.color === 'green' ? 'bg-green-100 text-green-700 border-green-300' : ''}
                            ${status.color === 'yellow' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : ''}
                          `}
                        >
                          {status.label}
                        </Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 sm:h-3">
                        <div
                          className={`h-2 sm:h-3 rounded-full transition-all duration-300 ${
                            status.color === 'red' ? 'bg-red-500' : 
                            status.color === 'orange' ? 'bg-orange-500' : 
                            status.color === 'green' ? 'bg-green-500' : 
                            'bg-yellow-500'
                          }`}
                          style={{ width: '75%' }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown by Dimension */}
      <Card className="glass-card border-0 shadow-lg hover-lift">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
            Performance by Region
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">On-time delivery rate breakdown by region</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMetrics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 sm:p-4 rounded-lg border border-border bg-muted/30">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">Loading...</p>
                  <p className="text-xl sm:text-2xl font-bold text-muted-foreground">-</p>
                </div>
              ))}
            </div>
          ) : regionalBreakdown ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {Object.entries(regionalBreakdown).map(([region, value]) => {
                const percentage = typeof value === 'number' && value <= 1 ? value * 100 : value
                return (
                  <div key={region} className="p-3 sm:p-4 rounded-lg border border-border bg-muted/30 hover-lift transition-all duration-200">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">{region}</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{percentage.toFixed(1)}%</p>
                    <div className="mt-2 sm:mt-3 w-full bg-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-300"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8 px-4 text-sm text-muted-foreground">
              Regional breakdown data not available. Metrics snapshots with breakdown data are required.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
