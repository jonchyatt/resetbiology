import { BaseAgent, LoggingIntent } from './BaseAgent';
import { VaultPartition } from '@/lib/vaultService';

export class ExerciseAgent extends BaseAgent {

    protected getVaultPartition(): VaultPartition {
        return 'Workouts';
    }

    async generateResponse(userId: string, message: string, history: any[]): Promise<string> {
        const systemPrompt = `
### ROLE
You are the Exercise Physiologist for Reset Biology. You guide users through workout programming, form, recovery, and adaptation.

### CORE KNOWLEDGE
- Progressive overload: Increase weight/reps/sets over time
- Recovery: 48-72 hours between same muscle groups
- Compound lifts: Squat, deadlift, bench, rows for maximum efficiency
- HIIT vs LISS: High intensity for time efficiency, low for active recovery
- Deload weeks: Every 4-6 weeks, reduce volume by 40-50%

### BEHAVIORS
1. Ask about current fitness level before programming
2. Form cues should be brief and actionable
3. If pain reported, distinguish muscle soreness vs. joint pain
4. Celebrate PRs and consistency wins
5. Bridge exercise to cellular health benefits
6. Reference their recent workout history when coaching
`;

        // Load vault context with user's recent workout history
        const vaultContext = await this.loadVaultContext(userId, message);

        const dynamicInstructions = await this.loadDynamicTraining(userId, 'EXERCISE');

        // Check for workout logging intent
        const loggingIntent = this.detectLoggingIntent(message);
        if (loggingIntent) {
            const logged = await this.handleLogging(userId, loggingIntent);
            if (logged) {
                const exercise = loggingIntent.data.exercise as string;
                return this.callLLM(
                    systemPrompt + vaultContext + dynamicInstructions +
                    `\n\n### JUST LOGGED\nUser completed: ${exercise}. Celebrate their effort and offer form/recovery tip.`,
                    message,
                    history
                );
            }
        }

        return this.callLLM(systemPrompt + vaultContext + dynamicInstructions, message, history);
    }

    protected detectLoggingIntent(message: string): LoggingIntent | null {
        const lower = message.toLowerCase();

        // Patterns: "did", "finished", "completed", "just did"
        const patterns = [
            /(?:did|finished|completed|just did|just finished)\s+(?:my\s+)?(.+?)(?:\s+workout)?$/i,
            /(?:workout|training)\s+(?:was|included)\s+(.+)/i,
            /(\d+)\s*(?:sets?|reps?)\s+(?:of\s+)?(.+?)(?:\s+at\s+(\d+)\s*(?:lbs?|pounds?|kg))?/i,
        ];

        for (const pattern of patterns) {
            const match = lower.match(pattern);
            if (match) {
                // Handle set/rep pattern separately
                if (match[2] && !isNaN(parseInt(match[1]))) {
                    return {
                        type: 'workout_set',
                        data: {
                            exercise: match[2].trim(),
                            sets: parseInt(match[1]),
                            weight: match[3] ? parseInt(match[3]) : null,
                            timestamp: new Date().toISOString()
                        }
                    };
                }

                if (match[1]) {
                    const exercise = match[1].trim();
                    if (exercise.length > 2 && exercise.length < 100) {
                        return {
                            type: 'workout_session',
                            data: {
                                exercise,
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
        const { timestamp } = intent.data as { timestamp: string };
        const date = new Date(timestamp);
        const localDate = date.toISOString().split('T')[0];
        const localTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        if (intent.type === 'workout_set') {
            const { exercise, sets, weight } = intent.data as {
                exercise: string;
                sets: number;
                weight: number | null;
            };

            return this.writeToUserVault(userId, {
                csvFile: 'workout_log.csv',
                csvRow: {
                    timestamp,
                    date: localDate,
                    time: localTime,
                    exercise,
                    sets,
                    weight: weight || '',
                    notes: 'Logged via voice'
                }
            });
        }

        if (intent.type === 'workout_session') {
            const { exercise } = intent.data as { exercise: string };

            return this.writeToUserVault(userId, {
                mdFile: `workout-${localDate}.md`,
                mdContent: `# Workout - ${localDate}\n\n**Time:** ${localTime}\n\n## Session\n${exercise}\n\n*Logged via voice*\n`
            });
        }

        return false;
    }
}
