import { BaseAgent, LoggingIntent } from './BaseAgent';
import { VaultPartition } from '@/lib/vaultService';

export class BreathAgent extends BaseAgent {

    protected getVaultPartition(): VaultPartition {
        return 'Breath Sessions';
    }

    async generateResponse(userId: string, message: string, history: any[]): Promise<string> {
        const systemPrompt = `
### ROLE
You are the Breath Coach for Reset Biology. You guide users through breathwork techniques for stress, energy, sleep, and vagal tone.

### CORE TECHNIQUES
- Vagal Reset (4-8): Inhale 4s, exhale 8s. Activates parasympathetic.
- Box Breathing (4-4-4-4): Navy SEAL technique. Calms under pressure.
- 4-7-8 Sleep Breath: Inhale 4, hold 7, exhale 8. Pre-sleep protocol.
- Energizing Breath (2-2): Quick inhale/exhale. Morning activation.
- Physiological Sigh: Double inhale through nose, long exhale. Instant calm.
- Wim Hof: 30 deep breaths, exhale hold, inhale hold. 3-4 rounds.

### BEHAVIORS
1. Match technique to user's goal (calm vs. energize)
2. Keep instructions simple - they may be doing it while you talk
3. If anxiety/stress mentioned, start with exhale-focused techniques
4. Celebrate consistency - breathwork compounds over time
5. Connect breath to HRV, vagal tone, and nervous system regulation
6. Reference their recent practice when encouraging them
`;

        // Load vault context with user's recent breath session history
        const vaultContext = await this.loadVaultContext(userId, message);

        const dynamicInstructions = await this.loadDynamicTraining(userId, 'BREATH');

        // Check for session completion logging
        const loggingIntent = this.detectLoggingIntent(message);
        if (loggingIntent) {
            const logged = await this.handleLogging(userId, loggingIntent);
            if (logged) {
                const technique = loggingIntent.data.technique as string;
                return this.callLLM(
                    systemPrompt + vaultContext + dynamicInstructions +
                    `\n\n### JUST LOGGED\nUser completed: ${technique} breathwork. Celebrate and share a quick benefit.`,
                    message,
                    history
                );
            }
        }

        return this.callLLM(systemPrompt + vaultContext + dynamicInstructions, message, history);
    }

    protected detectLoggingIntent(message: string): LoggingIntent | null {
        const lower = message.toLowerCase();

        // Patterns: "finished", "completed", "did X rounds", "just did"
        const patterns = [
            /(?:finished|completed|just did|did)\s+(?:my\s+)?(.+?)\s*(?:breathwork|breathing|session)?$/i,
            /(?:finished|completed|did)\s+(\d+)\s+rounds?\s+(?:of\s+)?(.+)/i,
            /(\d+)\s+(?:minutes?|min)\s+(?:of\s+)?(.+?)\s*(?:breathing|breathwork)?$/i,
        ];

        for (const pattern of patterns) {
            const match = lower.match(pattern);
            if (match) {
                // Handle rounds pattern
                if (match[2] && !isNaN(parseInt(match[1]))) {
                    return {
                        type: 'breath_session',
                        data: {
                            technique: match[2].trim(),
                            rounds: parseInt(match[1]),
                            timestamp: new Date().toISOString()
                        }
                    };
                }

                if (match[1]) {
                    const technique = match[1].trim();
                    if (technique.length > 2 && technique.length < 50) {
                        return {
                            type: 'breath_session',
                            data: {
                                technique,
                                timestamp: new Date().toISOString()
                            }
                        };
                    }
                }
            }
        }

        return null;
    }

    protected async handleLogging(userId: string, intent: LoggingIntent): Promise<boolean> {
        if (intent.type !== 'breath_session') return false;

        const { technique, rounds, timestamp } = intent.data as {
            technique: string;
            rounds?: number;
            timestamp: string;
        };

        const date = new Date(timestamp);
        const localDate = date.toISOString().split('T')[0];
        const localTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        return this.writeToUserVault(userId, {
            csvFile: 'breath_sessions.csv',
            csvRow: {
                timestamp,
                date: localDate,
                time: localTime,
                technique,
                rounds: rounds || 1,
                notes: 'Logged via voice'
            }
        });
    }
}
