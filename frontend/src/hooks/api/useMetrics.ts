import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { Metric, MetricSnapshot, MetricsOverview } from '../../types/api';

// Get metrics overview
export function useMetricsOverview(timeRange?: { start?: string; end?: string }) {
  return useQuery({
    queryKey: ['metrics', 'overview', timeRange],
    queryFn: async () => {
      const response = await api.get<MetricsOverview>('/metrics/overview', { params: timeRange });
      return response.data;
    },
    retry: 1,
  });
}

// Get all metric definitions
export function useMetricDefinitions() {
  return useQuery({
    queryKey: ['metrics', 'definitions'],
    queryFn: async () => {
      const response = await api.get<Metric[]>('/metrics/definitions');
      return response.data;
    },
    retry: 1,
  });
}

// Get single metric definition
export function useMetricDefinition(id: string | null) {
  return useQuery({
    queryKey: ['metrics', 'definitions', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<Metric>(`/metrics/definitions/${id}`);
      return response.data;
    },
    enabled: !!id,
    retry: 1,
  });
}

// Get metric snapshots
export function useMetricSnapshots(filters?: { metricId?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['metrics', 'snapshots', filters],
    queryFn: async () => {
      const response = await api.get<MetricSnapshot[]>('/metrics/snapshots', { params: filters });
      return response.data;
    },
    retry: 1,
  });
}

// Get snapshots for a specific metric
export function useMetricSnapshotsByMetric(metricId: string | null) {
  return useQuery({
    queryKey: ['metrics', 'snapshots', metricId],
    queryFn: async () => {
      if (!metricId) return null;
      const response = await api.get<MetricSnapshot[]>(`/metrics/snapshots/${metricId}`);
      return response.data;
    },
    enabled: !!metricId,
    retry: 1,
  });
}

// Compute metric on-demand
export function useComputeMetric() {
  return useMutation({
    mutationFn: async ({ metricId, dimension, timeRange }: { 
      metricId: string; 
      dimension?: { type: string; value?: string }; 
      timeRange?: { start?: string; end?: string } 
    }) => {
      const response = await api.post<any>(`/metrics/compute/${metricId}`, { dimension, timeRange });
      return response.data;
    },
  });
}

// Generate snapshot
export function useGenerateSnapshot() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ metricId, timeRangeStart, timeRangeEnd, dimension }: {
      metricId: string;
      timeRangeStart: string;
      timeRangeEnd: string;
      dimension?: { type: string; value?: string };
    }) => {
      const response = await api.post<MetricSnapshot>(`/metrics/snapshots/generate/${metricId}`, {
        timeRangeStart,
        timeRangeEnd,
        dimension,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['metrics', 'snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['metrics', 'snapshots', data.metricId] });
      queryClient.invalidateQueries({ queryKey: ['metrics', 'overview'] });
    },
  });
}

// Create metric definition (admin only)
export function useCreateMetricDefinition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Metric>) => {
      const response = await api.post<Metric>('/metrics/definitions', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics', 'definitions'] });
    },
  });
}

// Update metric definition (admin only)
export function useUpdateMetricDefinition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Metric> }) => {
      const response = await api.patch<Metric>(`/metrics/definitions/${id}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['metrics', 'definitions', data.id] });
      queryClient.invalidateQueries({ queryKey: ['metrics', 'definitions'] });
      queryClient.invalidateQueries({ queryKey: ['metrics', 'overview'] });
    },
  });
}

// Delete metric definition (admin only)
export function useDeleteMetricDefinition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/metrics/definitions/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics', 'definitions'] });
      queryClient.invalidateQueries({ queryKey: ['metrics', 'overview'] });
      queryClient.invalidateQueries({ queryKey: ['metrics', 'snapshots'] });
    },
  });
}