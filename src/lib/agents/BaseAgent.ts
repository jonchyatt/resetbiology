import { OpenAI } from 'openai';

export interface AgentContext {
    userId: string;
    history: { role: 'user' | 'assistant' | 'system'; content: string }[];
}

export abstract class BaseAgent {
    protected openai: OpenAI;
    protected model: string = 'gpt-4o'; // Default model

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
        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: userMessage }
        ];

        const completion = await this.openai.chat.completions.create({
            model: this.model,
            messages: messages,
        });

        return completion.choices[0].message?.content || "I'm having trouble thinking right now.";
    }

    /**
     * Fetches dynamic training data from the Vault.
     */
    protected async loadDynamicTraining(userId: string, agentName: string): Promise<string> {
        try {
            // We import dynamically to avoid circular deps if any
            const { getAgentTraining } = await import('../../app/actions/agentTraining');
            const training = await getAgentTraining(userId, agentName);
            if (training) {
                return `\n\n### DYNAMIC TRAINING (FROM ADMIN)\n${training}\n`;
            }
        } catch (e) {
            console.error('Failed to load dynamic training', e);
        }
        return "";
    }
}
