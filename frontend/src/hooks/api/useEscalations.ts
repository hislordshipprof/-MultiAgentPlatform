import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { Escalation, EscalationLog } from '../../types/api';

export interface FilterEscalationsDto {
  status?: 'active' | 'acknowledged' | 'resolved' | 'all';
  shipmentId?: string;
  deliveryIssueId?: string;
}

// Get all escalations with filters
export function useEscalations(filters?: FilterEscalationsDto) {
  return useQuery({
    queryKey: ['escalations', filters],
    queryFn: async () => {
      const response = await api.get<Escalation[]>('/escalations', { params: filters });
      return response.data;
    },
    retry: 1,
  });
}

// Get escalation for a shipment
export function useEscalation(shipmentId: string | null) {
  return useQuery({
    queryKey: ['escalations', shipmentId],
    queryFn: async () => {
      if (!shipmentId) return null;
      const response = await api.get<Escalation>(`/escalations/${shipmentId}`);
      return response.data;
    },
    enabled: !!shipmentId,
    retry: 1,
  });
}

// Get escalation contacts
export function useEscalationContacts() {
  return useQuery({
    queryKey: ['escalations', 'contacts'],
    queryFn: async () => {
      const response = await api.get<any[]>('/escalations/contacts');
      return response.data;
    },
    retry: 1,
  });
}

// Trigger escalation
export function useTriggerEscalation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { shipmentId: string; deliveryIssueId?: string; reason?: string }) => {
      const response = await api.post<EscalationLog>('/escalations/trigger', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['escalations', data.shipmentId] });
    },
  });
}

// Advance escalation
export function useAdvanceEscalation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ shipmentId, reason }: { shipmentId: string; reason?: string }) => {
      const response = await api.post<EscalationLog>(`/escalations/${shipmentId}/advance`, { reason });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['escalations', data.shipmentId] });
    },
  });
}

// Acknowledge escalation
export function useAcknowledgeEscalation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ shipmentId, method, notes }: { shipmentId: string; method: string; notes?: string }) => {
      const response = await api.post<EscalationLog>(`/escalations/${shipmentId}/acknowledge`, { method, notes });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['escalations', data.shipmentId] });
    },
  });
}
