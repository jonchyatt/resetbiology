import { OpenAI } from 'openai';
import { createVaultStructure, logToVault } from '../googleDriveService';
import { BioCoachAgent } from './BioCoach';
import { VisionTutorAgent } from './VisionTutor';
import { ProfessorAgent } from './Professor';
import { SalesCloserAgent } from './SalesCloser';
import { BaseAgent } from './BaseAgent';

// Define the available agents
export type AgentType = 'CONCIERGE' | 'BIO_COACH' | 'VISION_TUTOR' | 'PROFESSOR' | 'SALES_CLOSER';

interface AgentContext {
    userId: string;
    currentAgent: AgentType;
    history: { role: 'user' | 'assistant'; content: string }[];
}

export class AgentOrchestrator {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    /**
     * The main entry point. Receives a user message and routes it.
     */
    async handleMessage(userId: string, message: string, history: any[]) {
        // 1. Analyze Intent (Router)
        const intent = await this.classifyIntent(message);

        // 2. Load the appropriate Agent
        const agent = this.getAgent(intent);

        // 3. Execute Agent Logic
        const response = await agent.generateResponse(userId, message, history);

        return {
            agent: intent,
            response: response,
        };
    }

    /**
     * Uses a fast LLM call to classify the user's intent.
     */
    private async classifyIntent(message: string): Promise<AgentType> {
        const systemPrompt = `
      You are the "Reset Biology Concierge". Your job is to route the user to the right specialist.
      
      Available Specialists:
      1. BIO_COACH: Nutrition, diet, peptides, weight loss, nausea, side effects.
      2. VISION_TUTOR: Eye exercises, Gabor patches, blurry vision, headaches from screens.
      3. PROFESSOR: "Why" questions, mechanism of action, research, science theory.
      4. SALES_CLOSER: Pricing, objections ("too expensive"), buying the course.
      5. CONCIERGE: General greetings, "help", or unclear requests.

      Output ONLY the Agent Name (e.g., "BIO_COACH").
    `;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message },
            ],
            temperature: 0,
        });

        const intent = completion.choices[0].message?.content?.trim() as AgentType;
        return intent || 'CONCIERGE';
    }

    private getAgent(type: AgentType): BaseAgent {
        switch (type) {
            case 'BIO_COACH':
                return new BioCoachAgent();
            case 'VISION_TUTOR':
                return new VisionTutorAgent();
            case 'PROFESSOR':
                return new ProfessorAgent();
            case 'SALES_CLOSER':
                return new SalesCloserAgent();
            default:
                return new ConciergeAgent();
        }
    }
}

class ConciergeAgent extends BaseAgent {
    async generateResponse(userId: string, message: string, history: any[]) {
        return "Welcome to Reset Biology. How can I help you today? I can connect you with our Bio-Coach, Vision Tutor, or Professor.";
    }
}
