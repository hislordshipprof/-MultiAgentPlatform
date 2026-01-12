import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { Route, RouteStop } from '../../types/api';

// Get all routes
export function useRoutes(filters?: { date?: string; driverId?: string; region?: string }) {
  return useQuery({
    queryKey: ['routes', filters],
    queryFn: async () => {
      const response = await api.get<Route[]>('/routes', { params: filters });
      return response.data;
    },
    retry: 1,
  });
}

// Get single route by ID
export function useRoute(id: string | null) {
  return useQuery({
    queryKey: ['routes', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<Route>(`/routes/${id}`);
      return response.data;
    },
    enabled: !!id,
    retry: 1,
  });
}

// Get route stops
export function useRouteStops(routeId: string | null) {
  return useQuery({
    queryKey: ['routes', routeId, 'stops'],
    queryFn: async () => {
      if (!routeId) return null;
      const response = await api.get<RouteStop[]>(`/routes/${routeId}/stops`);
      return response.data;
    },
    enabled: !!routeId,
    retry: 1,
  });
}

// Get driver routes
export function useDriverRoutes(driverId: string | null) {
  return useQuery({
    queryKey: ['routes', 'driver', driverId],
    queryFn: async () => {
      if (!driverId) return null;
      const response = await api.get<Route[]>(`/routes/driver/${driverId}`);
      return response.data;
    },
    enabled: !!driverId,
    retry: 1,
  });
}

// Create route
export function useCreateRoute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post<Route>('/routes', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });
}

// Update route status
export function useUpdateRouteStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ routeId, status }: { routeId: string; status: string }) => {
      const response = await api.patch<Route>(`/routes/${routeId}`, { status });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['routes', variables.routeId] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });
}

// Update stop status
export function useUpdateStopStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ routeId, stopId, data }: { routeId: string; stopId: string; data: any }) => {
      const response = await api.patch<RouteStop>(`/routes/${routeId}/stops/${stopId}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['routes', variables.routeId, 'stops'] });
      queryClient.invalidateQueries({ queryKey: ['routes', variables.routeId] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });
}
