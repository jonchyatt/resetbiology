import { BaseAgent } from './BaseAgent';
import { prisma } from '@/lib/prisma';

export class OnboardingAgent extends BaseAgent {

    /**
     * Load current offers from database and format for agent context
     */
    private async loadPricingContext(): Promise<string> {
        try {
            const offers = await prisma.offer.findMany({
                where: { isActive: true },
                orderBy: { displayOrder: 'asc' },
                select: {
                    name: true,
                    trialPrice: true,
                    monthlyPrice: true,
                    tagline: true,
                    highlighted: true
                }
            });

            if (!offers || offers.length === 0) {
                return '';
            }

            const lines = offers.map(offer => {
                const marker = offer.highlighted ? ' ⭐ RECOMMENDED' : '';
                return `- ${offer.name}: ${offer.trialPrice} trial → ${offer.monthlyPrice}${marker}`;
            });

            return `\n\n### CURRENT OFFERS (use these exact prices)\n${lines.join('\n')}\n`;

        } catch (error) {
            console.error('[OnboardingAgent] Failed to load pricing:', error);
            return '';
        }
    }

    async generateResponse(userId: string, message: string, history: any[]): Promise<string> {
        const systemPrompt = `
### ROLE
You are the enrollment advisor for Reset Biology. Guide prospects through discovery using questions, not pitches.

### VOICE RULES
- Keep responses to 2-3 sentences max
- Ask one question at a time
- Never list multiple options - stay conversational
- Match the prospect's energy level
`;

        // Load dynamic training from admin panel (NEPQ methodology)
        const dynamicTraining = await this.loadDynamicTraining(userId, 'ONBOARDING');

        // Load current pricing from database
        const pricingContext = await this.loadPricingContext();

        const fullPrompt = systemPrompt + pricingContext + dynamicTraining;

        return this.callLLM(fullPrompt, message, history);
    }
}
