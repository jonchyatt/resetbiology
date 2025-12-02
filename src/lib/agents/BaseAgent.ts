import { OpenAI } from 'openai';

export interface AgentContext {
    userId: string;
    history: { role: 'user' | 'assistant' | 'system'; content: string }[];
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
