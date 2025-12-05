import { BaseAgent, LoggingIntent } from './BaseAgent';
import { VaultPartition } from '@/lib/vaultService';

export class NBackAgent extends BaseAgent {

    protected getVaultPartition(): VaultPartition {
        return 'Memory Training';
    }

    async generateResponse(userId: string, message: string, history: any[]): Promise<string> {
        const systemPrompt = `
### ROLE
You are the Cognitive Trainer for Reset Biology. You guide users through N-Back mental training for working memory and focus.

### CORE KNOWLEDGE
- Dual N-Back: Track position + audio simultaneously
- Triple N-Back: Add letter/color for advanced training
- N-Level: Start at 2-back, advance when >80% accuracy
- Session length: 20 trials minimum for effective training
- Frequency: Daily practice for 15-20 minutes optimal

### RESEARCH BACKING
- Jaeggi et al. (2008): Fluid intelligence gains from dual n-back
- Working memory is trainable and transfers to other tasks
- Consistency beats intensity - daily short sessions win

### BEHAVIORS
1. Celebrate level advances - they're hard-earned
2. If struggling, suggest dropping N-level temporarily
3. Explain the "why" - brain plasticity, focus improvement
4. Track patterns: Time of day, fatigue effects on performance
5. Connect to real-world benefits: focus, memory, decision-making
6. Reference their recent scores when coaching
`;

        // Load vault context with user's N-Back score history
        const vaultContext = await this.loadVaultContext(userId, message);

        const dynamicInstructions = await this.loadDynamicTraining(userId, 'NBACK');

        // Check for score logging intent
        const loggingIntent = this.detectLoggingIntent(message);
        if (loggingIntent) {
            const logged = await this.handleLogging(userId, loggingIntent);
            if (logged) {
                const nLevel = loggingIntent.data.nLevel as number;
                const accuracy = loggingIntent.data.accuracy as number;
                return this.callLLM(
                    systemPrompt + vaultContext + dynamicInstructions +
                    `\n\n### JUST LOGGED\nUser scored ${accuracy}% on ${nLevel}-back. Celebrate appropriately and offer coaching.`,
                    message,
                    history
                );
            }
        }

        return this.callLLM(systemPrompt + vaultContext + dynamicInstructions, message, history);
    }

    protected detectLoggingIntent(message: string): LoggingIntent | null {
        const lower = message.toLowerCase();

        // Patterns: score reports, level completions
        const patterns = [
            // "got 85% on 3-back" or "scored 90 percent"
            /(?:got|scored|hit)\s+(\d+)\s*%?\s+(?:on\s+)?(\d+)[- ]?back/i,
            // "3-back at 85%"
            /(\d+)[- ]?back\s+(?:at\s+)?(\d+)\s*%/i,
            // "finished level 4" or "beat level 3"
            /(?:finished|beat|completed|passed)\s+(?:level\s+)?(\d+)[- ]?back/i,
            // "advanced to 4-back"
            /advanced\s+to\s+(\d+)[- ]?back/i,
        ];

        for (const pattern of patterns) {
            const match = lower.match(pattern);
            if (match) {
                // Score pattern with accuracy
                if (match[2] && !isNaN(parseInt(match[1]))) {
                    const first = parseInt(match[1]);
                    const second = parseInt(match[2]);
                    // Determine which is accuracy vs n-level
                    const accuracy = first > 10 ? first : second;
                    const nLevel = first <= 10 ? first : second;

                    return {
                        type: 'nback_score',
                        data: {
                            nLevel,
                            accuracy,
                            timestamp: new Date().toISOString()
                        }
                    };
                }

                // Level advancement without score
                if (match[1] && !match[2]) {
                    return {
                        type: 'nback_advancement',
                        data: {
                            nLevel: parseInt(match[1]),
                            timestamp: new Date().toISOString()
                        }
                    };
                }
            }
        }

        return null;
    }

    protected async handleLogging(userId: string, intent: LoggingIntent): Promise<boolean> {
        const { timestamp } = intent.data as { timestamp: string };
        const date = new Date(timestamp);
        const localDate = date.toISOString().split('T')[0];
        const localTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        if (intent.type === 'nback_score') {
            const { nLevel, accuracy } = intent.data as { nLevel: number; accuracy: number };
            return this.writeToUserVault(userId, {
                csvFile: 'memory_scores.csv',
                csvRow: {
                    timestamp,
                    date: localDate,
                    time: localTime,
                    n_level: nLevel,
                    accuracy,
                    type: 'session',
                    notes: 'Logged via voice'
                }
            });
        }

        if (intent.type === 'nback_advancement') {
            const { nLevel } = intent.data as { nLevel: number };
            return this.writeToUserVault(userId, {
                csvFile: 'memory_scores.csv',
                csvRow: {
                    timestamp,
                    date: localDate,
                    time: localTime,
                    n_level: nLevel,
                    type: 'advancement',
                    notes: 'Level up! Logged via voice'
                }
            });
        }

        return false;
    }
}
