import { OpenAI } from 'openai';
import {
    buildAgentContext,
    writeToVault,
    analyzeQueryIntent,
    VaultPartition,
    VaultWriteOptions
} from '@/lib/vaultService';

export interface AgentContext {
    userId: string;
    history: { role: 'user' | 'assistant' | 'system'; content: string }[];
}

export interface LoggingIntent {
    type: string;
    data: Record<string, unknown>;
    confirmed?: boolean;
}

export abstract class BaseAgent {
    protected openai: OpenAI;
    protected model: string = 'gpt-4o-mini'; // Fast model for voice
    protected maxTokens: number = 150; // Keep responses concise for voice

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    /**
     * Generates a response based on the user message and context.
     */
    abstract generateResponse(userId: string, message: string, history: any[]): Promise<string>;

    /**
     * Override in subclasses to specify which vault partition this agent reads/writes
     */
    protected getVaultPartition(): VaultPartition | null {
        return null;
    }

    /**
     * Load user's history from their Google Drive Vault
     * RAG-optimized with query intent analysis
     */
    protected async loadVaultContext(userId: string, userMessage: string): Promise<string> {
        const partition = this.getVaultPartition();
        if (!partition) return '';

        try {
            return await buildAgentContext(userId, partition, userMessage);
        } catch (error) {
            // Graceful degradation - agent works without vault
            console.log(`[${this.constructor.name}] Vault read skipped:`, error);
            return '';
        }
    }

    /**
     * Detect if user message contains a logging intent
     * Override in subclasses with domain-specific patterns
     */
    protected detectLoggingIntent(message: string): LoggingIntent | null {
        return null;
    }

    /**
     * Handle writing logged data to vault
     * Override in subclasses with domain-specific write logic
     */
    protected async handleLogging(userId: string, intent: LoggingIntent): Promise<boolean> {
        const partition = this.getVaultPartition();
        if (!partition) return false;

        // Default implementation - subclasses should override
        console.log(`[${this.constructor.name}] Logging intent detected but not handled:`, intent);
        return false;
    }

    /**
     * Write data to user's vault (convenience wrapper)
     */
    protected async writeToUserVault(userId: string, options: Omit<VaultWriteOptions, 'folder'>): Promise<boolean> {
        const partition = this.getVaultPartition();
        if (!partition) return false;

        try {
            const result = await writeToVault(userId, {
                ...options,
                folder: partition
            });
            return result.success;
        } catch (error) {
            console.error(`[${this.constructor.name}] Vault write failed:`, error);
            return false;
        }
    }

    /**
     * Helper to get time of day for logging
     */
    protected getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 21) return 'evening';
        return 'night';
    }

    /**
     * Helper to call the LLM with system instructions.
     */
    protected async callLLM(
        systemPrompt: string,
        userMessage: string,
        history: any[] = []
    ): Promise<string> {
        // Add voice brevity instruction
        const voiceOptimizedPrompt = systemPrompt + `

### VOICE RESPONSE RULES (CRITICAL)
- Keep responses under 2-3 sentences
- Be conversational, not verbose
- No bullet points or lists - speak naturally
- Get to the point quickly
- End with a simple question if needed`;

        const messages: any[] = [
            { role: 'system', content: voiceOptimizedPrompt },
            ...history,
            { role: 'user', content: userMessage }
        ];

        const completion = await this.openai.chat.completions.create({
            model: this.model,
            messages: messages,
            max_tokens: this.maxTokens,
            temperature: 0.7,
        });

        return completion.choices[0].message?.content || "I'm having trouble thinking right now.";
    }

    /**
     * Fetches dynamic training data from the database.
     */
    protected async loadDynamicTraining(userId: string, agentName: string): Promise<string> {
        try {
            // Import prisma dynamically to avoid issues
            const { prisma } = await import('@/lib/prisma');

            // Find training for this agent (global - not user specific for now)
            const training = await prisma.agentTraining.findFirst({
                where: { agentId: agentName },
                orderBy: { updatedAt: 'desc' }
            });

            if (training?.content) {
                return `\n\n### CUSTOM TRAINING INSTRUCTIONS\n${training.content}\n`;
            }
        } catch (e) {
            console.error('Failed to load dynamic training:', e);
        }
        return "";
    }
}
