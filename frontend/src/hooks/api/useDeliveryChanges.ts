import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

export interface DeliveryChangeRequest {
  id: string;
  shipmentId: string;
  requestedByUserId: string;
  changeType: 'reschedule' | 'update_instructions' | 'change_address';
  newValue: string;
  newDate?: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  notes?: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  shipment?: {
    id: string;
    trackingNumber: string;
    currentStatus: string;
    toAddress: string;
    promisedDeliveryDate?: string;
  };
  requestedByUser?: {
    id: string;
    name: string;
    email: string;
  };
  reviewedByUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateDeliveryChangeDto {
  shipmentId: string;
  changeType: 'reschedule' | 'update_instructions' | 'change_address';
  newValue: string;
  newDate?: string;
  notes?: string;
}

export interface FilterDeliveryChangesDto {
  shipmentId?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'applied';
  changeType?: 'reschedule' | 'update_instructions' | 'change_address';
}

export interface UpdateDeliveryChangeDto {
  status?: 'pending' | 'approved' | 'rejected' | 'applied';
  notes?: string;
}

// Get all delivery change requests with filters
export function useDeliveryChanges(filters?: FilterDeliveryChangesDto) {
  return useQuery({
    queryKey: ['delivery-changes', filters],
    queryFn: async () => {
      const response = await api.get<DeliveryChangeRequest[]>('/delivery-changes', { params: filters });
      return response.data;
    },
    retry: 1,
  });
}

// Get single delivery change request by ID
export function useDeliveryChange(id: string | null) {
  return useQuery({
    queryKey: ['delivery-changes', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<DeliveryChangeRequest>(`/delivery-changes/${id}`);
      return response.data;
    },
    enabled: !!id,
    retry: 1,
  });
}

// Get delivery change requests for a shipment
export function useShipmentDeliveryChanges(shipmentId: string | null) {
  return useQuery({
    queryKey: ['delivery-changes', 'shipment', shipmentId],
    queryFn: async () => {
      if (!shipmentId) return null;
      const response = await api.get<DeliveryChangeRequest[]>(`/delivery-changes`, {
        params: { shipmentId },
      });
      return response.data;
    },
    enabled: !!shipmentId,
    retry: 1,
  });
}

// Create delivery change request
export function useRequestDeliveryChange() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateDeliveryChangeDto) => {
      const response = await api.post<DeliveryChangeRequest>('/delivery-changes', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-changes'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-changes', 'shipment', data.shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['shipments', data.shipmentId] });
    },
  });
}

// Update delivery change request (approve/reject)
export function useUpdateDeliveryChange() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateDeliveryChangeDto }) => {
      const response = await api.patch<DeliveryChangeRequest>(`/delivery-changes/${id}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-changes', data.id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-changes'] });
      if (data.shipmentId) {
        queryClient.invalidateQueries({ queryKey: ['delivery-changes', 'shipment', data.shipmentId] });
        queryClient.invalidateQueries({ queryKey: ['shipments', data.shipmentId] });
      }
    },
  });
}
