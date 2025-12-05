import { BaseAgent, LoggingIntent } from './BaseAgent';
import { VaultPartition } from '@/lib/vaultService';

export class JournalAgent extends BaseAgent {

    protected getVaultPartition(): VaultPartition {
        return 'Journal';
    }

    async generateResponse(userId: string, message: string, history: any[]): Promise<string> {
        const systemPrompt = `
### ROLE
You are the Reflection Guide for Reset Biology. You facilitate journaling, emotional processing, and pattern recognition.

### APPROACH
- Reflective listening: Mirror back what you hear
- Open questions: "What does that bring up for you?"
- No advice unless asked - hold space for processing
- Pattern recognition: "I notice you've mentioned X before..."
- Gratitude anchoring: End sessions with something positive

### PROMPTS TO OFFER
- "What are you most proud of this week?"
- "What's one thing you'd do differently?"
- "Where did you feel most alive recently?"
- "What's weighing on you that you haven't said out loud?"

### BEHAVIORS
1. Be warm and present, not clinical
2. Validate emotions without trying to fix them
3. Keep it conversational, not therapy-speak
4. If heavy topics arise, acknowledge and suggest professional support
5. Connect reflection to growth and self-awareness
6. Reference patterns from their past reflections when appropriate
`;

        // Load vault context with user's recent journal entries
        const vaultContext = await this.loadVaultContext(userId, message);

        const dynamicInstructions = await this.loadDynamicTraining(userId, 'JOURNAL');

        // Detect and log emotional themes
        const loggingIntent = this.detectLoggingIntent(message);
        if (loggingIntent) {
            // Log in background, don't block response
            this.handleLogging(userId, loggingIntent).catch(err =>
                console.error('[JournalAgent] Logging failed:', err)
            );
        }

        return this.callLLM(systemPrompt + vaultContext + dynamicInstructions, message, history);
    }

    protected detectLoggingIntent(message: string): LoggingIntent | null {
        // Journal entries are always logged if they're substantial
        if (message.length > 50) {
            const lower = message.toLowerCase();

            // Detect mood/emotion keywords
            let mood: string | undefined;
            const moodPatterns = {
                positive: ['happy', 'excited', 'grateful', 'proud', 'peaceful', 'hopeful', 'energized'],
                negative: ['sad', 'anxious', 'frustrated', 'stressed', 'tired', 'overwhelmed', 'angry'],
                neutral: ['okay', 'fine', 'normal', 'alright']
            };

            for (const [moodType, keywords] of Object.entries(moodPatterns)) {
                for (const keyword of keywords) {
                    if (lower.includes(keyword)) {
                        mood = keyword;
                        break;
                    }
                }
                if (mood) break;
            }

            return {
                type: 'journal_entry',
                data: {
                    content: message,
                    mood,
                    timestamp: new Date().toISOString()
                }
            };
        }

        return null;
    }

    protected async handleLogging(userId: string, intent: LoggingIntent): Promise<boolean> {
        if (intent.type !== 'journal_entry') return false;

        const { content, mood, timestamp } = intent.data as {
            content: string;
            mood?: string;
            timestamp: string;
        };

        const date = new Date(timestamp);
        const localDate = date.toISOString().split('T')[0];
        const localTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        // Create markdown journal entry
        const mdContent = `# Journal Entry - ${localDate}

**Time:** ${localTime}
${mood ? `**Mood:** ${mood}\n` : ''}

## Reflection

${content}

---
*Captured via voice journaling*
`;

        return this.writeToUserVault(userId, {
            mdFile: `journal-${localDate}-${Date.now().toString(36)}.md`,
            mdContent
        });
    }
}
