import { BaseAgent } from './BaseAgent';
import { logToVault } from '../googleDriveService';

export class BioCoachAgent extends BaseAgent {

    async generateResponse(userId: string, message: string, history: any[]): Promise<string> {
        // 1. Define the Persona and Clinical Protocols
        const systemPrompt = `
### ROLE & PERSONA
You are "Bio-Coach," the lead metabolic success specialist for 'Reset Biology.'
Your Tone: Empathetic, warm, scientifically grounded, but encouraging. You speak like a trusted friend who happens to be a medical expert.

### CORE BEHAVIORS
1. **Validate First:** Always validate the user's struggle before giving advice.
2. **The "Bridge" Technique:** Answer their biology question briefly, then bridge to how the course/protocol solves it.
3. **Symptom Triangulation:** If the user reports nausea, ask: "Did you eat fried food? Drink enough water? Inject in the thigh?"

### CLINICAL PROTOCOLS (DO NOT DEVIATE)
- **Semaglutide Week 1-4:** 0.25mg.
- **Semaglutide Week 5-8:** 0.5mg.
- **Fasting:** We use 16:8 intermittent fasting.
- **Peptides:** BPC-157 is for healing/gut health. TB-500 is for flexibility/recovery.

### DATA PRIVACY
You do not store long-term memories yourself. You assume the "Vault" has the data.
If the user says "I took my dose", you must acknowledge it and internally flag it for logging (simulated here by your response).
    `;

        // 1.5 Load Dynamic Training
        const dynamicInstructions = await this.loadDynamicTraining(userId, 'BIO_COACH');
        const fullPrompt = systemPrompt + dynamicInstructions;

        // 2. Check for "Logging" Intents (Simple heuristic for now)
        if (this.detectLoggingIntent(message)) {
            await this.handleLogging(userId, message);
            // We append a system note to the history so the LLM knows it was logged
            history.push({ role: 'system', content: 'ACTION: The previous user action was successfully logged to the Vault.' });
        }

        // 3. Generate Response
        return this.callLLM(fullPrompt, message, history);
    }

    private detectLoggingIntent(message: string): boolean {
        const keywords = ['took', 'ate', 'drank', 'injected', 'dose', 'log'];
        return keywords.some(k => message.toLowerCase().includes(k));
    }

    private async handleLogging(userId: string, message: string) {
        // In a real scenario, we would use an LLM to extract structured data.
        // For now, we log the raw message to the 'nutrition' or 'peptide' log based on keywords.

        let type: 'nutrition' | 'peptide' | 'workout' = 'nutrition';
        if (message.toLowerCase().includes('inject') || message.toLowerCase().includes('dose')) {
            type = 'peptide';
        } else if (message.toLowerCase().includes('run') || message.toLowerCase().includes('lift')) {
            type = 'workout';
        }

        try {
            await logToVault(userId, type, {
                raw_input: message,
                source: 'voice_agent'
            });
            console.log(`[BioCoach] Logged to Vault: ${type}`);
        } catch (error) {
            console.error('[BioCoach] Failed to log to Vault:', error);
        }
    }
}
