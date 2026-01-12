import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { ChatResponse, VoiceSessionResponse, ChatMessage } from '../../types/api';

// Send chat message
export function useChat() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      message: string; 
      sessionId?: string; 
      linkedShipmentId?: string;
    }): Promise<ChatResponse> => {
      const response = await api.post<ChatResponse>('/ai/chat', data);
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate agent session to refresh transcript
      if (data.sessionId) {
        queryClient.invalidateQueries({ queryKey: ['agent-sessions', data.sessionId] });
        queryClient.invalidateQueries({ queryKey: ['agent-sessions'] });
      }
    },
  });
}

// Create voice session
export function useCreateVoiceSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data?: { linkedShipmentId?: string }): Promise<VoiceSessionResponse> => {
      const response = await api.post<VoiceSessionResponse>('/ai/voice/session', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent-sessions', data.sessionId] });
      queryClient.invalidateQueries({ queryKey: ['agent-sessions'] });
    },
  });
}

// Update voice session transcript
export function useUpdateVoiceSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sessionId, transcript, outcome }: { 
      sessionId: string; 
      transcript: ChatMessage[]; 
      outcome?: any;
    }) => {
      const response = await api.post(`/ai/voice/session/${sessionId}/update`, { transcript, outcome });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent-sessions', variables.sessionId] });
    },
  });
}

// Complete voice session
export function useCompleteVoiceSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await api.post(`/ai/voice/session/${sessionId}/complete`);
      return response.data;
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['agent-sessions', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['agent-sessions'] });
    },
  });
}
