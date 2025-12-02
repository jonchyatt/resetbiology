import { OpenAI } from 'openai';
import { BaseAgent } from './BaseAgent';

// Import all specialized agents
import { BioCoachAgent } from './BioCoach';
import { VisionTutorAgent } from './VisionTutor';
import { ProfessorAgent } from './Professor';
import { SalesCloserAgent } from './SalesCloser';
import { PeptideAgent } from './PeptideAgent';
import { ExerciseAgent } from './ExerciseAgent';
import { NutritionAgent } from './NutritionAgent';
import { BreathAgent } from './BreathAgent';
import { JournalAgent } from './JournalAgent';
import { NBackAgent } from './NBackAgent';
import { CourseAgent } from './CourseAgent';

// All available agent types
export type AgentType =
    | 'CONCIERGE'
    | 'PEPTIDE'
    | 'EXERCISE'
    | 'NUTRITION'
    | 'BREATH'
    | 'JOURNAL'
    | 'VISION'
    | 'NBACK'
    | 'COURSE'
    | 'SALES'
    | 'PROFESSOR'
    | 'BIO_COACH'      // Legacy - routes to appropriate specialist
    | 'VISION_TUTOR'   // Legacy - routes to VISION
    | 'SALES_CLOSER';  // Legacy - routes to SALES

// Map page paths to agents
const PAGE_TO_AGENT: Record<string, AgentType> = {
    '/peptides': 'PEPTIDE',
    '/workout': 'EXERCISE',
    '/nutrition': 'NUTRITION',
    '/breathe': 'BREATH',
    '/journal': 'JOURNAL',
    '/vision': 'VISION',
    '/nback': 'NBACK',
    '/modules': 'COURSE',
    '/portal': 'CONCIERGE',
    '/order': 'SALES',
};

export class AgentOrchestrator {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    /**
     * Main entry point. Can accept an optional pageContext for direct routing.
     */
    async handleMessage(userId: string, message: string, history: any[], pageContext?: string) {
        let agentType: AgentType;

        // If page context provided, route directly to that agent (no LLM call)
        if (pageContext && PAGE_TO_AGENT[pageContext]) {
            agentType = PAGE_TO_AGENT[pageContext];
        } else {
            // Fall back to intent classification
            agentType = await this.classifyIntent(message);
        }

        // Get the agent instance
        const agent = this.getAgent(agentType);

        // Generate response
        const response = await agent.generateResponse(userId, message, history);

        return {
            agent: agentType,
            response: response,
        };
    }

    /**
     * Direct routing - skip intent classification when you know which agent you need
     */
    async handleDirectMessage(userId: string, message: string, history: any[], agentType: AgentType) {
        const agent = this.getAgent(agentType);
        const response = await agent.generateResponse(userId, message, history);
        return { agent: agentType, response };
    }

    /**
     * Classify intent when no page context is provided
     */
    private async classifyIntent(message: string): Promise<AgentType> {
        const systemPrompt = `You route users to specialists. Output ONLY the agent name.

Agents:
- PEPTIDE: Peptide dosing, timing, side effects, reconstitution
- EXERCISE: Workouts, form, programming, recovery
- NUTRITION: Diet, macros, fasting, supplements
- BREATH: Breathwork, stress, vagal tone
- JOURNAL: Reflection, emotional processing, patterns
- VISION: Eye exercises, 12-week vision program
- NBACK: Mental training, cognitive exercises
- COURSE: Lesson content, module progress
- SALES: Pricing, objections, subscription questions
- PROFESSOR: Science questions, mechanism of action, research
- CONCIERGE: Greetings, general help, unclear requests

Output the agent name only (e.g., "PEPTIDE").`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message },
            ],
            temperature: 0,
            max_tokens: 20,
        });

        const intent = completion.choices[0].message?.content?.trim().toUpperCase() as AgentType;

        // Handle legacy agent names
        if (intent === 'BIO_COACH') return 'NUTRITION';
        if (intent === 'VISION_TUTOR') return 'VISION';
        if (intent === 'SALES_CLOSER') return 'SALES';

        return intent || 'CONCIERGE';
    }

    /**
     * Get agent instance by type
     */
    private getAgent(type: AgentType): BaseAgent {
        switch (type) {
            case 'PEPTIDE':
                return new PeptideAgent();
            case 'EXERCISE':
                return new ExerciseAgent();
            case 'NUTRITION':
            case 'BIO_COACH':
                return new NutritionAgent();
            case 'BREATH':
                return new BreathAgent();
            case 'JOURNAL':
                return new JournalAgent();
            case 'VISION':
            case 'VISION_TUTOR':
                return new VisionTutorAgent();
            case 'NBACK':
                return new NBackAgent();
            case 'COURSE':
                return new CourseAgent();
            case 'SALES':
            case 'SALES_CLOSER':
                return new SalesCloserAgent();
            case 'PROFESSOR':
                return new ProfessorAgent();
            default:
                return new ConciergeAgent();
        }
    }
}

/**
 * Concierge - welcomes users and helps route them
 */
class ConciergeAgent extends BaseAgent {
    async generateResponse(userId: string, message: string, history: any[]) {
        const systemPrompt = `
### ROLE
You are the Reset Biology Concierge. You warmly greet users and help them find the right specialist.

### AVAILABLE SPECIALISTS
- Peptide Protocol Specialist - dosing, timing, side effects
- Exercise Physiologist - workouts, form, recovery
- Nutrition Coach - diet, fasting, supplements
- Breath Coach - breathwork, stress management
- Reflection Guide - journaling, emotional processing
- Vision Tutor - eye exercises, vision program
- Cognitive Trainer - N-Back, mental training
- Course Guide - lesson content, progress
- Sales - pricing, subscription questions

### BEHAVIORS
1. Be warm and welcoming
2. Ask what they need help with if unclear
3. Briefly describe relevant specialists
4. Keep it conversational, not a menu reading
`;

        const dynamicInstructions = await this.loadDynamicTraining(userId, 'CONCIERGE');
        return this.callLLM(systemPrompt + dynamicInstructions, message, history);
    }
}
