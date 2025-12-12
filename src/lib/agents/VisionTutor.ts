import { BaseAgent, LoggingIntent } from './BaseAgent';
import { VaultPartition } from '@/lib/vaultService';

export class VisionTutorAgent extends BaseAgent {

    protected getVaultPartition(): VaultPartition {
        return 'Vision Training';
    }

    async generateResponse(userId: string, message: string, history: any[]): Promise<string> {
        const systemPrompt = `
### ROLE
You are the Vision Tutor for Reset Biology's 12-week Vision Training program. You guide users through vision exercises, track their progress, and explain the science.

### 12-WEEK PROGRAM STRUCTURE
- Weeks 1-2: Foundation (baseline tests, basic exercises)
- Weeks 3-4: Near Focus (convergence, accommodation)
- Weeks 5-6: Far Focus (distance clarity, relaxation)
- Weeks 7-8: Coordination (tracking, saccades)
- Weeks 9-10: Integration (real-world application)
- Weeks 11-12: Mastery (advanced exercises, maintenance plan)

### EXERCISE TYPES
- Gabor Patches: Neural contrast training. 12" from face, focus on center cross.
- Snellen Charts: Measure acuity. Test both eyes, then each separately.
- Near/Far Focus: Pencil push-ups, window-distance alternation.
- Palming: Rest eyes, cup hands, visualize blackness. 2-3 minutes.
- Eye Yoga: Figure-8s, circles, corner-to-corner tracking.

### BEHAVIORS
1. Know which week/day the user is on
2. Give step-by-step exercise instructions
3. Track and celebrate improvements in Snellen scores
4. If headaches or strain, suggest palming break
5. Connect exercises to real vision improvements
6. Reference their recent progress when coaching
`;

        // Load vault context with user's vision training history
        const vaultContext = await this.loadVaultContext(userId, message);

        const dynamicInstructions = await this.loadDynamicTraining(userId, 'VISION');

        // Check for logging intent
        const loggingIntent = this.detectLoggingIntent(message);
        if (loggingIntent) {
            const logged = await this.handleLogging(userId, loggingIntent);
            if (logged) {
                const exercise = loggingIntent.data.exercise as string || 'vision exercise';
                return this.callLLM(
                    systemPrompt + vaultContext + dynamicInstructions +
                    `\n\n### JUST LOGGED\nUser completed: ${exercise}. Celebrate and offer next step.`,
                    message,
                    history
                );
            }
        }

        return this.callLLM(systemPrompt + vaultContext + dynamicInstructions, message, history);
    }

    protected detectLoggingIntent(message: string): LoggingIntent | null {
        const lower = message.toLowerCase();

        // Patterns: score reports, exercise completions, blur mentions
        const patterns = [
            // Snellen score: "20/20", "20/40", etc.
            /(?:score|read|saw|got)\s*(?:was|is)?\s*(20\/\d+)/i,
            // Completed exercise
            /(?:finished|completed|did)\s+(?:my\s+)?(.+?)\s*(?:exercise|training)?$/i,
            // Distance measurement
            /(?:clear|blur)\s+(?:at|from)\s+(\d+)\s*(?:inches?|cm|feet)/i,
        ];

        for (const pattern of patterns) {
            const match = lower.match(pattern);
            if (match) {
                // Snellen score
                if (match[1] && match[1].includes('/')) {
                    return {
                        type: 'vision_score',
                        data: {
                            snellenScore: match[1],
                            timestamp: new Date().toISOString()
                        }
                    };
                }

                // Exercise completion
                if (match[1]) {
                    return {
                        type: 'vision_session',
                        data: {
                            exercise: match[1].trim(),
                            timestamp: new Date().toISOString()
                        }
                    };
                }
            }
        }

        // Check for blur/strain mentions
        if (lower.includes('blur') || lower.includes('strain') || lower.includes('headache')) {
            return {
                type: 'vision_note',
                data: {
                    note: message,
                    type: lower.includes('blur') ? 'blur' : 'strain',
                    timestamp: new Date().toISOString()
                }
            };
        }

        return null;
    }

    protected async handleLogging(userId: string, intent: LoggingIntent): Promise<boolean> {
        const { timestamp } = intent.data as { timestamp: string };
        const date = new Date(timestamp);
        const localDate = date.toISOString().split('T')[0];
        const localTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        if (intent.type === 'vision_score') {
            const { snellenScore } = intent.data as { snellenScore: string };
            return this.writeToUserVault(userId, {
                csvFile: 'vision_scores.csv',
                csvRow: {
                    timestamp,
                    date: localDate,
                    time: localTime,
                    snellen_score: snellenScore,
                    type: 'measurement',
                    notes: 'Logged via voice'
                }
            });
        }

        if (intent.type === 'vision_session') {
            const { exercise } = intent.data as { exercise: string };
            return this.writeToUserVault(userId, {
                csvFile: 'vision_scores.csv',
                csvRow: {
                    timestamp,
                    date: localDate,
                    time: localTime,
                    exercise,
                    type: 'session',
                    notes: 'Logged via voice'
                }
            });
        }

        if (intent.type === 'vision_note') {
            const { note, type: noteType } = intent.data as { note: string; type: string };
            return this.writeToUserVault(userId, {
                csvFile: 'vision_scores.csv',
                csvRow: {
                    timestamp,
                    date: localDate,
                    time: localTime,
                    type: noteType,
                    notes: note
                }
            });
        }

        return false;
    }
}
