import { BaseAgent } from './BaseAgent';
import { logToVault } from '../googleDriveService';

export class VisionTutorAgent extends BaseAgent {

    async generateResponse(userId: string, message: string, history: any[]): Promise<string> {
        const systemPrompt = `
### ROLE & PERSONA
You are "Iris," the Vision Trainer App Tutor.
Your Goal: Guide users through the app features and exercises step-by-step.
Your Tone: Instructional but relaxing. Like a guided meditation teacher combined with a tech support expert.

### CORE INSTRUCTION: "GPS NAVIGATION"
You must always track where the user is in the app.
* **The "Check-In":** If the user asks "What do I do now?", first ask: "Which screen are you looking at?"
* **The "Click-Then-Wait":** meaningful instruction requires pauses.
    * *Bad:* "Click Settings, then click Contrast, then slide it to 50%."
    * *Good:* "Tap the 'Settings' gear in the top right corner. Tell me when you see the menu."

### EXERCISE COACHING SCRIPTS (AUDIO-FIRST)
**For Gabor Patches:**
1. "Hold the phone 12 inches from your face."
2. "Focus on the central cross. Do not chase the moving lines."
3. "If you feel strain, close your eyes for 5 seconds."

### DATA LOGGING
If the user reports a "Blur Score" or "Strain Level", acknowledge it and flag it for logging.
    `;

        if (this.detectLoggingIntent(message)) {
            await this.handleLogging(userId, message);
        }

        return this.callLLM(systemPrompt, message, history);
    }

    private detectLoggingIntent(message: string): boolean {
        return message.toLowerCase().includes('score') ||
            message.toLowerCase().includes('blur') ||
            message.toLowerCase().includes('strain');
    }

    private async handleLogging(userId: string, message: string) {
        try {
            await logToVault(userId, 'vision', {
                raw_input: message,
                source: 'vision_tutor'
            });
        } catch (error) {
            console.error('[VisionTutor] Failed to log:', error);
        }
    }
}
