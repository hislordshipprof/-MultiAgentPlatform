import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { Shipment, ShipmentScan } from '../../types/api';

// Get all shipments
export function useShipments() {
  return useQuery({
    queryKey: ['shipments'],
    queryFn: async () => {
      const response = await api.get<Shipment[]>('/shipments');
      return response.data;
    },
    retry: 1,
  });
}

// Get single shipment by ID
export function useShipment(id: string | null) {
  return useQuery({
    queryKey: ['shipments', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<Shipment>(`/shipments/${id}`);
      return response.data;
    },
    enabled: !!id,
    retry: 1,
  });
}

// Track shipment by tracking number (public - no auth required)
export function useTrackShipment(trackingNumber: string | null) {
  return useQuery({
    queryKey: ['shipments', 'track', trackingNumber],
    queryFn: async () => {
      if (!trackingNumber) return null;
      const response = await api.get<Shipment>(`/shipments/track/${trackingNumber}`);
      return response.data;
    },
    enabled: !!trackingNumber,
    retry: 1,
  });
}

// Get shipment timeline
export function useShipmentTimeline(id: string | null) {
  return useQuery({
    queryKey: ['shipments', id, 'timeline'],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<any>(`/shipments/${id}/timeline`);
      return response.data;
    },
    enabled: !!id,
    retry: 1,
  });
}

// Create scan
export function useCreateScan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ shipmentId, data }: { shipmentId: string; data: CreateScanDto }) => {
      const response = await api.post<ShipmentScan>(`/shipments/${shipmentId}/scans`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shipments', variables.shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
  });
}

// Update shipment status
export function useUpdateShipmentStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ shipmentId, data }: { shipmentId: string; data: UpdateStatusDto }) => {
      const response = await api.patch<Shipment>(`/shipments/${shipmentId}/status`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shipments', variables.shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
  });
}

export interface CreateScanDto {
  scanType: 'pickup' | 'in_transit' | 'arrival' | 'departure' | 'out_for_delivery' | 'delivered' | 'failed';
  location: string;
  notes?: string;
}

export interface UpdateStatusDto {
  status: 'PENDING' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';
}
