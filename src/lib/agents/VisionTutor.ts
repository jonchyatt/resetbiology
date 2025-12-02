import { BaseAgent } from './BaseAgent';
import { logToVault } from '../googleDriveService';

export class VisionTutorAgent extends BaseAgent {

    async generateResponse(userId: string, message: string, history: any[]): Promise<string> {
        const systemPrompt = `
### ROLE
You are the Vision Tutor for Reset Biology's 12-week ScreenFit program. You guide users through vision exercises, track their progress, and explain the science.

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
`;

        const dynamicInstructions = await this.loadDynamicTraining(userId, 'VISION');

        if (this.detectLoggingIntent(message)) {
            await this.handleLogging(userId, message);
        }

        return this.callLLM(systemPrompt + dynamicInstructions, message, history);
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
