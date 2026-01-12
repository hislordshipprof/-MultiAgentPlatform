import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AgentSessionsService } from '../agent-sessions/agent-sessions.service';
import { AiToolsService } from './ai-tools.service';
import { LogisticsRouterAgent } from './agents/router.agent';
import { ShipmentTrackingAgent } from './agents/tracking.agent';
import { DeliveryIssueAgent } from './agents/issue.agent';
import { DeliveryChangeAgent } from './agents/change.agent';
import { LogisticsAnalyticsAgent } from './agents/analytics.agent';
import { AgentChannel, AgentSessionStatus } from '@prisma/client';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);
  private openai: OpenAI;

  constructor(
    private agentSessionsService: AgentSessionsService,
    private aiToolsService: AiToolsService,
    private routerAgent: LogisticsRouterAgent,
    private trackingAgent: ShipmentTrackingAgent,
    private issueAgent: DeliveryIssueAgent,
    private changeAgent: DeliveryChangeAgent,
    private analyticsAgent: LogisticsAnalyticsAgent,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'mock-key',
    });
  }

  /**
   * Handle chat message - Uses OpenAI API with tools
   */
  async handleChat(
    userId: string,
    userRole: string,
    message: string,
    sessionId?: string,
    linkedShipmentId?: string,
  ): Promise<{ text: string; sessionId: string; toolCalls?: any[] }> {
    try {
      let session: any = sessionId
        ? await this.agentSessionsService.findOne(sessionId, userId, userRole as any).catch(() => null)
        : null;

      // Create new session if needed
      if (!session) {
        session = await this.agentSessionsService.create(
          {
            channel: AgentChannel.chat,
            linkedShipmentId,
          },
          userId,
          userRole as any,
        );
      }

      // Get or initialize transcript
      let transcript: ChatMessage[] = (session?.transcript as any) || [];

      // Build messages for OpenAI (include system prompt for router agent)
      const messages: any[] = [
        {
          role: 'system',
          content: this.routerAgent.getSystemPrompt(),
        },
        ...transcript.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content: message,
        },
      ];

      // Get tool definitions
      const tools = this.aiToolsService.getToolDefinitions();

      // Call OpenAI API with tools
      let responseText = '';
      let toolCalls: any[] = [];
      let maxIterations = 5; // Prevent infinite loops
      let iteration = 0;
      let lastCompletionId: string | undefined;

      while (iteration < maxIterations) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messages,
          tools: tools,
          tool_choice: 'auto', // Let the model decide when to use tools
          temperature: 0.7,
        });

        lastCompletionId = completion.id;
        const choice = completion.choices[0];
        const messageContent = choice.message;

        // Handle tool calls
        if (messageContent.tool_calls && messageContent.tool_calls.length > 0) {
          // Add assistant message with tool calls to conversation
          messages.push({
            role: 'assistant',
            content: messageContent.content || null,
            tool_calls: messageContent.tool_calls,
          });

          // Execute each tool call
          for (const toolCall of messageContent.tool_calls) {
            try {
              // Handle different tool call types
              if (toolCall.type === 'function') {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments || '{}');

                // Execute tool (special handling for tools that need userId)
                const toolResult = await this.aiToolsService.executeTool(
                  toolName,
                  toolArgs,
                  (toolName === 'create_delivery_issue' || toolName === 'request_delivery_change') ? userId : undefined,
                );

                // Add tool result to conversation
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(toolResult),
                });

                // Track tool calls for outcome
                toolCalls.push({
                  tool: toolName,
                  id: toolCall.id,
                  input: toolArgs,
                  result: toolResult,
                });
              }
            } catch (error) {
              const toolName = toolCall.type === 'function' ? toolCall.function.name : 'unknown';
              this.logger.error(`Error executing tool ${toolName}: ${error.message}`);
              // Add error to conversation
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message }),
              });
            }
          }

          // Continue loop to get final response after tool execution
          iteration++;
          continue;
        }

        // No more tool calls - get final response
        responseText = messageContent.content || 'I apologize, but I could not generate a response.';
        break;
      }

      if (iteration >= maxIterations) {
        responseText = 'I apologize, but the request took too long to process. Please try again.';
      }

      // Update transcript
      transcript.push({ role: 'user', content: message });
      transcript.push({ role: 'assistant', content: responseText });

      // Update session with transcript
      if (session) {
        await this.agentSessionsService.update(
          session.id,
          {
            transcript: transcript as any,
            outcome: toolCalls.length > 0 ? { toolCalls } as any : undefined,
            openAiSessionId: lastCompletionId, // Store OpenAI completion ID
          },
          userId,
          userRole as any,
        );
      }

      return {
        text: responseText,
        sessionId: session?.id || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      this.logger.error(`Error handling chat: ${error.message}`, error.stack);

      // Check if it's an API key error
      if (error.message?.includes('API key') || error.message?.includes('Invalid')) {
        return {
          text: 'I apologize, but there is an issue with the AI service configuration. Please contact support.',
          sessionId: sessionId || '',
        };
      }

      return {
        text: 'I apologize, but I encountered an error processing your request. Please try again or contact support.',
        sessionId: sessionId || '',
      };
    }
  }

  /**
   * Create voice session token for OpenAI Realtime API
   */
  async createVoiceSession(
    userId: string,
    linkedShipmentId?: string,
  ): Promise<{ sessionId: string; token: string; url: string }> {
    try {
      // Create agent session
      const session = await this.agentSessionsService.create(
        {
          channel: AgentChannel.voice,
          linkedShipmentId,
        },
        userId,
        'customer' as any,
      );

      // Call OpenAI Realtime API to create session
      // Note: OpenAI Realtime API requires beta access and specific setup
      // The actual implementation may vary based on OpenAI's current API
      try {
        // Build instructions with system prompt and tools
        const instructions = this.buildRealtimeInstructions();
        const tools = this.aiToolsService.getToolDefinitions();

        // Create Realtime session
        // Note: OpenAI Realtime API structure may vary - this is based on current API
        // The session ID is typically in the response, but structure may differ
        const realtimeSession = await this.openai.beta.realtime.sessions.create({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'alloy',
          instructions: instructions,
          tools: tools.map((tool: any) => ({
            type: 'function',
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters,
          })),
          temperature: 0.7,
        });

        // Extract session ID from response (structure may vary)
        const sessionIdFromApi = (realtimeSession as any).id || (realtimeSession as any).session_id || session.id;

        // Store OpenAI session ID
        await this.agentSessionsService.update(
          session.id,
          {
            openAiSessionId: sessionIdFromApi,
          },
          userId,
          'customer' as any,
        );

        return {
          sessionId: session.id,
          token: sessionIdFromApi, // Use session ID as token
          url: `wss://api.openai.com/v1/realtime?session_id=${sessionIdFromApi}`,
        };
      } catch (realtimeError) {
        this.logger.warn(
          `Failed to create OpenAI Realtime session (may require beta access): ${realtimeError.message}. Falling back to mock.`,
        );
        
        // Fallback: Return session info for frontend to handle WebSocket directly
        return {
          sessionId: session.id,
          token: 'fallback', // Frontend should use API key directly
          url: 'wss://api.openai.com/v1/realtime',
        };
      }
    } catch (error) {
      this.logger.error(`Error creating voice session: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle voice session update (transcript from Realtime API)
   */
  async updateVoiceSession(
    sessionId: string,
    transcript: ChatMessage[],
    outcome?: any,
  ): Promise<void> {
    try {
      // For voice sessions, we may not have userId/userRole readily available
      // Try to find session first to get user info
      const session = await this.agentSessionsService.findOne(sessionId, null, null);
      if (session && session.user) {
        await this.agentSessionsService.update(
          sessionId,
          {
            transcript: transcript as any,
            outcome: outcome as any,
          },
          session.user.id,
          session.user.role,
        );
      }
    } catch (error) {
      this.logger.error(`Error updating voice session: ${error.message}`, error.stack);
    }
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId: string): Promise<void> {
    try {
      const session = await this.agentSessionsService.findOne(sessionId, null, null).catch(() => null);
      if (session && session.user) {
        // Use updateOutcome or other method to mark session as completed
        // For now, just log - status management may be handled separately
        this.logger.log(`Session ${sessionId} completed`);
      }
    } catch (error) {
      this.logger.error(`Error completing session: ${error.message}`, error.stack);
    }
  }

  /**
   * Helper: Extract tracking number from message
   */
  private extractTrackingNumber(message: string): string | null {
    const match = message.match(/trk-\d+(-\d+)?/i);
    return match ? match[0].toUpperCase() : null;
  }

  /**
   * Helper: Extract change value from message
   */
  private extractChangeValue(
    message: string,
    changeType: 'reschedule' | 'update_instructions' | 'change_address',
  ): string {
    // Simple extraction - in production, use NLP
    if (changeType === 'reschedule') {
      // Try to extract date/time
      const dateMatch = message.match(/(tomorrow|next week|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}\/\d{4})/i);
      return dateMatch ? dateMatch[0] : message;
    }
    return message;
  }

  /**
   * Helper: Extract metric query from message
   */
  private extractMetricQuery(message: string): {
    metricKey?: string;
    dimension?: 'global' | 'region' | 'route' | 'driver';
    dimensionValue?: string;
  } {
    const lowerMsg = message.toLowerCase();
    let metricKey: string | undefined;
    let dimension: 'global' | 'region' | 'route' | 'driver' | undefined;

    if (lowerMsg.includes('on-time') || lowerMsg.includes('on time')) {
      metricKey = 'on_time_delivery_rate';
    } else if (lowerMsg.includes('first attempt') || lowerMsg.includes('first-attempt')) {
      metricKey = 'first_attempt_success_rate';
    } else if (lowerMsg.includes('open issue')) {
      metricKey = 'open_issues_count';
    } else if (lowerMsg.includes('sla risk') || lowerMsg.includes('sla-risk')) {
      metricKey = 'sla_risk_count';
    }

    if (lowerMsg.includes('region')) {
      dimension = 'region';
    } else if (lowerMsg.includes('route')) {
      dimension = 'route';
    } else if (lowerMsg.includes('driver')) {
      dimension = 'driver';
    }

    return { metricKey, dimension };
  }

  /**
   * Build instructions for OpenAI Realtime API
   */
  private buildRealtimeInstructions(): string {
    return `${this.routerAgent.getSystemPrompt()}

You have access to the following specialist capabilities:
1. **Shipment Tracking**: Use track_shipment and get_shipment_timeline tools to help customers track their packages
2. **Issue Reporting**: Use create_delivery_issue and track_shipment tools to help customers report problems
3. **Delivery Changes**: Use request_delivery_change and track_shipment tools to help customers modify their delivery
4. **Analytics**: Use get_metrics tool to answer operational questions

When a user asks a question:
1. First classify their intent (track, issue, change, analytics)
2. Use the appropriate tools to gather information or perform actions
3. Provide clear, friendly responses based on the tool results

Always be helpful, empathetic, and professional. If you're unsure, ask clarifying questions before using tools.`;
  }
}
