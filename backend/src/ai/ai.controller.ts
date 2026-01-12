import { Controller, Post, Body, Get, UseGuards, Request, Param } from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('chat')
  async chat(
    @Request() req: any,
    @Body() body: { message: string; sessionId?: string; linkedShipmentId?: string },
  ) {
    return this.aiService.chat(
      req.user.userId,
      req.user.role,
      body.message,
      body.sessionId,
      body.linkedShipmentId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('voice/session')
  async createVoiceSession(
    @Request() req: any,
    @Body() body: { linkedShipmentId?: string },
  ) {
    return this.aiService.createVoiceSession(req.user.userId, body.linkedShipmentId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('voice/session/:sessionId/update')
  async updateVoiceSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { transcript: any; outcome?: any },
  ) {
    return this.aiService.updateVoiceSession(sessionId, body.transcript, body.outcome);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('voice/session/:sessionId/complete')
  async completeVoiceSession(@Param('sessionId') sessionId: string) {
    return this.aiService.completeSession(sessionId);
  }
}
