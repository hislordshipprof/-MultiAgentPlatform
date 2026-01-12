import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { DeliveryIssue } from '../../types/api';

export interface FilterIssuesDto {
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'all';
  status?: 'open' | 'investigating' | 'resolved' | 'closed' | 'all';
  issueType?: 'damaged' | 'missing' | 'wrong_address' | 'missed_delivery' | 'delay' | 'other' | 'all';
  region?: string;
  shipmentId?: string;
}

// Get all issues with filters
export function useIssues(filters?: FilterIssuesDto, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['issues', filters],
    queryFn: async () => {
      const response = await api.get<DeliveryIssue[]>('/issues', { params: filters });
      return response.data;
    },
    enabled: options?.enabled !== false,
    retry: 1,
  });
}

// Get single issue by ID
export function useIssue(id: string | null) {
  return useQuery({
    queryKey: ['issues', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<DeliveryIssue>(`/issues/${id}`);
      return response.data;
    },
    enabled: !!id,
    retry: 1,
  });
}

// Get issues for a shipment
export function useShipmentIssues(shipmentId: string | null) {
  return useQuery({
    queryKey: ['issues', 'shipment', shipmentId],
    queryFn: async () => {
      if (!shipmentId) return null;
      const response = await api.get<DeliveryIssue[]>(`/issues/shipment/${shipmentId}`);
      return response.data;
    },
    enabled: !!shipmentId,
    retry: 1,
  });
}

// Create issue
export function useCreateIssue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { shipmentId: string; issueType: string; description: string }) => {
      const response = await api.post<DeliveryIssue>('/issues', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['issues', 'shipment', data.shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['shipments', data.shipmentId] });
    },
  });
}

// Update issue
export function useUpdateIssue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DeliveryIssue> }) => {
      const response = await api.patch<DeliveryIssue>(`/issues/${id}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['issues', data.id] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      if (data.shipmentId) {
        queryClient.invalidateQueries({ queryKey: ['issues', 'shipment', data.shipmentId] });
      }
    },
  });
}
