import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { AgentSession } from '../../types/api';

// Get all agent sessions
export function useAgentSessions(filters?: { userId?: string; channel?: string; status?: string }) {
  return useQuery({
    queryKey: ['agent-sessions', filters],
    queryFn: async () => {
      const response = await api.get<AgentSession[]>('/agent-sessions', { params: filters });
      return response.data;
    },
    retry: 1,
  });
}

// Get single agent session
export function useAgentSession(id: string | null) {
  return useQuery({
    queryKey: ['agent-sessions', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<AgentSession>(`/agent-sessions/${id}`);
      return response.data;
    },
    enabled: !!id,
    retry: 1,
  });
}

// Create agent session
export function useCreateAgentSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { channel: 'chat' | 'voice'; linkedShipmentId?: string; openAiSessionId?: string }) => {
      const response = await api.post<AgentSession>('/agent-sessions', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-sessions'] });
    },
  });
}

// Update agent session
export function useUpdateAgentSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AgentSession> }) => {
      const response = await api.patch<AgentSession>(`/agent-sessions/${id}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent-sessions', data.id] });
      queryClient.invalidateQueries({ queryKey: ['agent-sessions'] });
    },
  });
}

// End agent session
export function useEndAgentSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<AgentSession>(`/agent-sessions/${id}/end`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent-sessions', data.id] });
      queryClient.invalidateQueries({ queryKey: ['agent-sessions'] });
    },
  });
}

// Append transcript
export function useAppendTranscript() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, messages }: { id: string; messages: any[] }) => {
      const response = await api.post<AgentSession>(`/agent-sessions/${id}/transcript`, { messages });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent-sessions', data.id] });
    },
  });
}

// Update outcome
export function useUpdateOutcome() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, outcome }: { id: string; outcome: any }) => {
      const response = await api.post<AgentSession>(`/agent-sessions/${id}/outcome`, { outcome });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent-sessions', data.id] });
    },
  });
}
