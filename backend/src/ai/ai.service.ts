import { Injectable } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';

@Injectable()
export class AiService {
  constructor(private orchestrator: AiOrchestratorService) {}

  async chat(userId: string, userRole: string, message: string, sessionId?: string, linkedShipmentId?: string) {
    return this.orchestrator.handleChat(userId, userRole, message, sessionId, linkedShipmentId);
  }

  async createVoiceSession(userId: string, linkedShipmentId?: string) {
    return this.orchestrator.createVoiceSession(userId, linkedShipmentId);
  }

  async updateVoiceSession(sessionId: string, transcript: any, outcome?: any) {
    return this.orchestrator.updateVoiceSession(sessionId, transcript, outcome);
  }

  async completeSession(sessionId: string) {
    return this.orchestrator.completeSession(sessionId);
  }
}
