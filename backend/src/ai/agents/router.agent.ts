import { Injectable } from '@nestjs/common';

export type Intent = 'track' | 'issue' | 'change' | 'analytics' | 'unknown';

export interface IntentClassification {
  intent: Intent;
  confidence: number;
  extractedData?: any;
}

@Injectable()
export class LogisticsRouterAgent {
  /**
   * System prompt for the router agent
   */
  getSystemPrompt(): string {
    return `You are the LogisticsRouterAgent, responsible for classifying user intent and routing to specialist agents.

Your job is to analyze user messages and determine the primary intent:
- "track": User wants to track a shipment (e.g., "Where is my package?", "Track TRK-12345")
- "issue": User wants to report a delivery issue (e.g., "My package is damaged", "I didn't receive my order")
- "change": User wants to request a delivery change (e.g., "Reschedule delivery", "Change address")
- "analytics": User wants operational metrics/analytics (e.g., "What's our on-time rate?", "How many open issues?")

When you detect an intent, respond with the intent classification and extract any relevant data (tracking numbers, issue types, etc.).

You should route to specialist agents based on intent:
- track → ShipmentTrackingAgent
- issue → DeliveryIssueAgent
- change → DeliveryChangeAgent
- analytics → LogisticsAnalyticsAgent

Always be helpful and clarify user intent if unclear.`;
  }

  /**
   * Classify intent from user message
   * Note: This method is kept for backward compatibility but actual classification
   * is now done by OpenAI in the orchestrator. This is a fallback/helper method.
   */
  classifyIntent(message: string): IntentClassification {
    const lowerMessage = message.toLowerCase();

    // Check for tracking intent
    if (
      lowerMessage.includes('track') ||
      lowerMessage.includes('where is') ||
      lowerMessage.includes('package') ||
      lowerMessage.includes('shipment') ||
      lowerMessage.match(/trk-\d+/i)
    ) {
      const trackingMatch = message.match(/trk-\d+(-\d+)?/i);
      return {
        intent: 'track',
        confidence: 0.9,
        extractedData: {
          trackingNumber: trackingMatch ? trackingMatch[0] : null,
        },
      };
    }

    // Check for issue intent
    if (
      lowerMessage.includes('damaged') ||
      lowerMessage.includes('broken') ||
      lowerMessage.includes('missing') ||
      lowerMessage.includes('wrong') ||
      lowerMessage.includes('issue') ||
      lowerMessage.includes('problem') ||
      lowerMessage.includes("didn't receive") ||
      lowerMessage.includes('not received')
    ) {
      return {
        intent: 'issue',
        confidence: 0.85,
        extractedData: {},
      };
    }

    // Check for change intent
    if (
      lowerMessage.includes('reschedule') ||
      lowerMessage.includes('change') ||
      lowerMessage.includes('update') ||
      lowerMessage.includes('modify') ||
      lowerMessage.includes('different time') ||
      lowerMessage.includes('different address')
    ) {
      return {
        intent: 'change',
        confidence: 0.8,
        extractedData: {},
      };
    }

    // Check for analytics intent
    if (
      lowerMessage.includes('metric') ||
      lowerMessage.includes('performance') ||
      lowerMessage.includes('on-time') ||
          lowerMessage.includes('kpi') ||
          lowerMessage.includes('statistic') ||
          lowerMessage.includes('rate') ||
          lowerMessage.includes('how many') ||
          lowerMessage.includes('how well')
    ) {
      return {
        intent: 'analytics',
        confidence: 0.8,
        extractedData: {},
      };
    }

    return {
      intent: 'unknown',
      confidence: 0.5,
      extractedData: {},
    };
  }
}
