import { BaseAgent, LoggingIntent } from './BaseAgent';
import { VaultPartition, writeToVault } from '@/lib/vaultService';

export class BioCoachAgent extends BaseAgent {

    // BioCoach can access multiple partitions - uses Nutrition as primary
    protected getVaultPartition(): VaultPartition {
        return 'Nutrition';
    }

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

        // Load vault context
        const vaultContext = await this.loadVaultContext(userId, message);

        // 1.5 Load Dynamic Training
        const dynamicInstructions = await this.loadDynamicTraining(userId, 'BIO_COACH');
        const fullPrompt = systemPrompt + vaultContext + dynamicInstructions;

        // 2. Check for "Logging" Intents
        const loggingIntent = this.detectLoggingIntent(message);
        if (loggingIntent) {
            const logged = await this.handleLogging(userId, loggingIntent);
            if (logged) {
                // We append a system note to the history so the LLM knows it was logged
                history.push({ role: 'system', content: 'ACTION: The previous user action was successfully logged to the Vault.' });
            }
        }

        // 3. Generate Response
        return this.callLLM(fullPrompt, message, history);
    }

    protected detectLoggingIntent(message: string): LoggingIntent | null {
        const lower = message.toLowerCase();
        const keywords = ['took', 'ate', 'drank', 'injected', 'dose', 'log'];

        if (!keywords.some(k => lower.includes(k))) {
            return null;
        }

        // Determine type
        let type: 'nutrition' | 'peptide' | 'workout' = 'nutrition';
        if (lower.includes('inject') || lower.includes('dose') || lower.includes('peptide')) {
            type = 'peptide';
        } else if (lower.includes('run') || lower.includes('lift') || lower.includes('workout')) {
            type = 'workout';
        }

        return {
            type: `biocoach_${type}`,
            data: {
                rawInput: message,
                logType: type,
                timestamp: new Date().toISOString()
            }
        };
    }

    protected async handleLogging(userId: string, intent: LoggingIntent): Promise<boolean> {
        const { rawInput, logType, timestamp } = intent.data as {
            rawInput: string;
            logType: string;
            timestamp: string;
        };

        const date = new Date(timestamp);
        const localDate = date.toISOString().split('T')[0];
        const localTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        // Determine folder based on log type
        const folder: VaultPartition = logType === 'peptide' ? 'Peptides' :
                                       logType === 'workout' ? 'Workouts' : 'Nutrition';

        try {
            const result = await writeToVault(userId, {
                folder,
                csvFile: `${logType}_log.csv`,
                csvRow: {
                    timestamp,
                    date: localDate,
                    time: localTime,
                    raw_input: rawInput,
                    source: 'bio_coach'
                }
            });
            console.log(`[BioCoach] Logged to Vault: ${logType}`);
            return result.success;
        } catch (error) {
            console.error('[BioCoach] Failed to log to Vault:', error);
            return false;
        }
    }
}
