import { BaseAgent, LoggingIntent } from './BaseAgent';
import { VaultPartition } from '@/lib/vaultService';

export class NutritionAgent extends BaseAgent {

    protected getVaultPartition(): VaultPartition {
        return 'Nutrition';
    }

    async generateResponse(userId: string, message: string, history: any[]): Promise<string> {
        const systemPrompt = `
### ROLE
You are the Nutrition Coach for Reset Biology. You guide users through meal planning, macros, fasting protocols, and supplements.

### CORE KNOWLEDGE
- Protein target: 0.8-1g per pound of bodyweight
- Intermittent fasting: 16:8 is default protocol
- Eating window: Typically 12pm-8pm, flexible based on schedule
- Pre-workout: Light protein + carbs 1-2 hours before
- Post-workout: Protein within 2 hours, timing less critical than total daily

### BEHAVIORS
1. Ask about current eating patterns before suggesting changes
2. No extreme restriction advice - sustainable changes only
3. If GLP-1 user, acknowledge reduced appetite as expected
4. Food logging should feel simple, not obsessive
5. Connect nutrition to energy, sleep, and cellular health
6. Reference their recent eating patterns when giving advice
`;

        // Load vault context with user's recent nutrition history
        const vaultContext = await this.loadVaultContext(userId, message);

        const dynamicInstructions = await this.loadDynamicTraining(userId, 'NUTRITION');

        // Check for food logging intent
        const loggingIntent = this.detectLoggingIntent(message);
        if (loggingIntent) {
            const logged = await this.handleLogging(userId, loggingIntent);
            if (logged) {
                const food = loggingIntent.data.food as string;
                return this.callLLM(
                    systemPrompt + vaultContext + dynamicInstructions +
                    `\n\n### JUST LOGGED\nUser logged eating: ${food}. Briefly confirm and offer nutrition insight.`,
                    message,
                    history
                );
            }
        }

        return this.callLLM(systemPrompt + vaultContext + dynamicInstructions, message, history);
    }

    protected detectLoggingIntent(message: string): LoggingIntent | null {
        const lower = message.toLowerCase();

        // Patterns: "ate", "had", "just ate", "for breakfast/lunch/dinner"
        const patterns = [
            /(?:ate|had|eating|just had|just ate)\s+(.+?)(?:\s+for\s+(?:breakfast|lunch|dinner|snack))?$/i,
            /for\s+(?:breakfast|lunch|dinner|snack)\s+(?:i\s+)?(?:had|ate)\s+(.+)/i,
            /(?:breakfast|lunch|dinner|snack)\s+was\s+(.+)/i,
        ];

        for (const pattern of patterns) {
            const match = lower.match(pattern);
            if (match && match[1]) {
                const food = match[1].trim();
                if (food.length > 2 && food.length < 200) {
                    // Determine meal type
                    let mealType = 'snack';
                    if (lower.includes('breakfast')) mealType = 'breakfast';
                    else if (lower.includes('lunch')) mealType = 'lunch';
                    else if (lower.includes('dinner')) mealType = 'dinner';
                    else {
                        // Infer from time of day
                        const hour = new Date().getHours();
                        if (hour >= 5 && hour < 11) mealType = 'breakfast';
                        else if (hour >= 11 && hour < 15) mealType = 'lunch';
                        else if (hour >= 17 && hour < 21) mealType = 'dinner';
                    }

                    return {
                        type: 'food_entry',
                        data: {
                            food,
                            mealType,
                            timestamp: new Date().toISOString()
                        }
                    };
                }
            }
        }

        return null;
    }

    protected async handleLogging(userId: string, intent: LoggingIntent): Promise<boolean> {
        if (intent.type !== 'food_entry') return false;

        const { food, mealType, timestamp } = intent.data as {
            food: string;
            mealType: string;
            timestamp: string;
        };

        const date = new Date(timestamp);
        const localDate = date.toISOString().split('T')[0];
        const localTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        return this.writeToUserVault(userId, {
            csvFile: 'nutrition_tracker.csv',
            csvRow: {
                timestamp,
                date: localDate,
                time: localTime,
                food,
                meal_type: mealType,
                notes: 'Logged via voice'
            }
        });
    }
}
