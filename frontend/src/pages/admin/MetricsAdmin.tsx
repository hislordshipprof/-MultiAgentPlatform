import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit2, Trash2, Plus, Save, X, TrendingUp, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useMetricDefinitions, useCreateMetricDefinition, useUpdateMetricDefinition, useDeleteMetricDefinition } from '../../hooks/api/useMetrics'
import type { Metric } from '../../types/api'

export default function MetricsAdmin() {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Fetch metric definitions
  const { data: metrics = [], isLoading, error } = useMetricDefinitions()

  // Mutations
  const createMutation = useCreateMetricDefinition()
  const updateMutation = useUpdateMetricDefinition()
  const deleteMutation = useDeleteMetricDefinition()

  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    aggregationType: 'ratio' | 'count' | 'avg';
    dimension: 'global' | 'region' | 'route' | 'driver';
    targetValue: number;
    warningThreshold: number | null;
    criticalThreshold: number | null;
    isVisibleOnDashboard: boolean;
  }>({
    name: '',
    description: '',
    aggregationType: 'ratio',
    dimension: 'global',
    targetValue: 0,
    warningThreshold: null,
    criticalThreshold: null,
    isVisibleOnDashboard: true
  })

  const handleEdit = (metric: Metric) => {
    setEditingId(metric.id)
    setEditForm({
      name: metric.name,
      description: metric.description,
      aggregationType: metric.aggregationType as any,
      dimension: metric.dimension as any,
      targetValue: metric.targetValue,
      warningThreshold: metric.warningThreshold ?? null,
      criticalThreshold: metric.criticalThreshold ?? null,
      isVisibleOnDashboard: metric.isVisibleOnDashboard
    })
  }

  // Generate key from name (snake_case, lowercase)
  const generateKey = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/-/g, '_') // Replace hyphens with underscores
      .replace(/_+/g, '_') // Replace multiple underscores with single underscore
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
  }

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          data: {
            ...editForm,
            warningThreshold: editForm.warningThreshold ?? undefined,
            criticalThreshold: editForm.criticalThreshold ?? undefined,
          }
        })
        setEditingId(null)
      } else if (isCreating) {
        // Generate key from name for new metrics
        const key = generateKey(editForm.name)
        if (!key) {
          alert('Metric name is required to generate a unique key')
          return
        }
        
        await createMutation.mutateAsync({
          ...editForm,
          key, // Include the generated key
          warningThreshold: editForm.warningThreshold ?? undefined,
          criticalThreshold: editForm.criticalThreshold ?? undefined,
        })
        setIsCreating(false)
      }
      setEditForm({
        name: '',
        description: '',
        aggregationType: 'ratio',
        dimension: 'global',
        targetValue: 0,
        warningThreshold: null,
        criticalThreshold: null,
        isVisibleOnDashboard: true
      })
    } catch (error: any) {
      console.error('Failed to save metric:', error)
      const errorMessage = error?.response?.data?.message 
        || error?.response?.data?.errors?.join(', ')
        || error?.message 
        || 'Failed to save metric. Please check all required fields are filled.'
      alert(errorMessage)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setIsCreating(false)
    setEditForm({
      name: '',
      description: '',
      aggregationType: 'ratio',
      dimension: 'global',
      targetValue: 0,
      warningThreshold: null,
      criticalThreshold: null,
      isVisibleOnDashboard: true
    })
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this metric definition? This will also delete all associated snapshots.')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (error) {
        console.error('Failed to delete metric:', error)
        alert('Failed to delete metric definition. Please try again.')
      }
    }
  }

  const toggleVisibility = async (metric: Metric) => {
    try {
      await updateMutation.mutateAsync({
        id: metric.id,
        data: { isVisibleOnDashboard: !metric.isVisibleOnDashboard }
      })
    } catch (error) {
      console.error('Failed to toggle visibility:', error)
    }
  }

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
      {/* Header */}
      <Card className="glass-card border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Metrics Admin
              </CardTitle>
              <CardDescription className="mt-1">
                Edit metric definitions, targets, thresholds, and visibility settings
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreating(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Metric
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <Card className="glass-card border-2 border-primary shadow-lg">
          <CardHeader>
            <CardTitle>
              {isCreating ? 'Create New Metric' : 'Edit Metric'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Metric Name *</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="e.g., On-Time Delivery Rate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aggregationType">Aggregation Type *</Label>
                <select
                  id="aggregationType"
                  value={editForm.aggregationType}
                  onChange={(e) => setEditForm({ ...editForm, aggregationType: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="ratio">Ratio</option>
                  <option value="count">Count</option>
                  <option value="avg">Average</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description *</Label>
                <Input
                  id="description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Describe what this metric measures"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dimension">Dimension</Label>
                <select
                  id="dimension"
                  value={editForm.dimension}
                  onChange={(e) => setEditForm({ ...editForm, dimension: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="global">Global</option>
                  <option value="region">Region</option>
                  <option value="route">Route</option>
                  <option value="driver">Driver</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetValue">Target Value *</Label>
                <Input
                  id="targetValue"
                  type="number"
                  value={editForm.targetValue}
                  onChange={(e) => setEditForm({ ...editForm, targetValue: parseFloat(e.target.value) || 0 })}
                  placeholder="95"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warningThreshold">Warning Threshold</Label>
                <Input
                  id="warningThreshold"
                  type="number"
                  value={editForm.warningThreshold ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, warningThreshold: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="90"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="criticalThreshold">Critical Threshold</Label>
                <Input
                  id="criticalThreshold"
                  type="number"
                  value={editForm.criticalThreshold ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, criticalThreshold: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="85"
                />
              </div>
              <div className="space-y-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isVisible"
                  checked={editForm.isVisibleOnDashboard}
                  onChange={(e) => setEditForm({ ...editForm, isVisibleOnDashboard: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="isVisible" className="cursor-pointer">
                  Visible on Dashboard
                </Label>
              </div>
            </div>
            <div className="flex gap-2 pt-4 border-t border-border">
              <Button 
                onClick={handleSave} 
                className="gap-2"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Save className="h-4 w-4" />
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={handleCancel} className="gap-2">
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics List */}
      <Card className="glass-card border-0 shadow-lg hover-lift">
        <CardHeader>
          <CardTitle>Metric Definitions ({metrics.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading metrics...</div>
          ) : metrics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No metrics configured.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Thresholds</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((metric) => (
                    <TableRow key={metric.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-semibold text-foreground">{metric.name}</p>
                          <p className="text-xs text-muted-foreground">{metric.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{metric.key}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{metric.aggregationType}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{metric.dimension}</p>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{metric.targetValue}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          {metric.warningThreshold !== null && (
                            <p className="text-orange-600">Warning: {metric.warningThreshold}</p>
                          )}
                          {metric.criticalThreshold !== null && (
                            <p className="text-red-600">Critical: {metric.criticalThreshold}</p>
                          )}
                          {metric.warningThreshold === null && metric.criticalThreshold === null && (
                            <p className="text-muted-foreground">-</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleVisibility(metric)}
                          className="gap-1"
                          disabled={updateMutation.isPending}
                        >
                          {metric.isVisibleOnDashboard ? (
                            <>
                              <Eye className="h-4 w-4 text-green-500" />
                              <span className="text-xs">Visible</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-4 w-4 text-gray-400" />
                              <span className="text-xs">Hidden</span>
                            </>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(metric)}
                            className="gap-1 hover-lift"
                          >
                            <Edit2 className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(metric.id)}
                            className="gap-1 text-red-500 hover:text-red-600 hover-lift"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
