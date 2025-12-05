import { BaseAgent, LoggingIntent } from './BaseAgent';
import { VaultPartition } from '@/lib/vaultService';

// Peptide name normalization map
const PEPTIDE_ALIASES: Record<string, string> = {
    'bpc': 'BPC-157',
    'bpc157': 'BPC-157',
    'bpc-157': 'BPC-157',
    'tb500': 'TB-500',
    'tb-500': 'TB-500',
    'tb': 'TB-500',
    'sema': 'Semaglutide',
    'semaglutide': 'Semaglutide',
    'ozempic': 'Semaglutide',
    'wegovy': 'Semaglutide',
    'ipa': 'Ipamorelin',
    'ipamorelin': 'Ipamorelin',
    'cjc': 'CJC-1295',
    'cjc1295': 'CJC-1295',
    'cjc-1295': 'CJC-1295',
    'ghk': 'GHK-Cu',
    'ghk-cu': 'GHK-Cu',
    'ghkcu': 'GHK-Cu',
    'pt141': 'PT-141',
    'pt-141': 'PT-141',
    'thymosin': 'Thymosin Alpha-1',
    'ta1': 'Thymosin Alpha-1',
    'mots-c': 'MOTS-c',
    'motsc': 'MOTS-c',
    'ss-31': 'SS-31',
    'ss31': 'SS-31',
};

export class PeptideAgent extends BaseAgent {

    protected getVaultPartition(): VaultPartition {
        return 'Peptides';
    }

    async generateResponse(userId: string, message: string, history: any[]): Promise<string> {
        const systemPrompt = `
### ROLE
You are the Peptide Protocol Specialist for Reset Biology. You help users with peptide dosing, timing, reconstitution, and side effect management.

### CORE KNOWLEDGE
- Semaglutide: Week 1-4 = 0.25mg, Week 5-8 = 0.5mg, maintenance varies
- BPC-157: 250-500mcg daily for gut/healing, subcutaneous or oral
- TB-500: 2.5mg twice weekly loading, then weekly maintenance
- GHK-Cu: Skin/hair regeneration, topical or subcutaneous
- Reconstitution: Bacteriostatic water, inject slowly down vial side
- Ipamorelin: 200-300mcg 2-3x daily for GH release
- CJC-1295: 1-2mg weekly (with or without DAC)

### BEHAVIORS
1. Always ask about current dose before suggesting changes
2. If side effects reported, ask: injection site? time of day? food intake?
3. Never give medical advice without "consult your provider" disclaimer
4. If user reports taking a dose, confirm you've logged it
5. Reference their recent history when giving advice
`;

        // Load vault context with user's recent peptide history
        const vaultContext = await this.loadVaultContext(userId, message);

        // Load dynamic training
        const dynamicInstructions = await this.loadDynamicTraining(userId, 'PEPTIDE');

        // Check for logging intent
        const loggingIntent = this.detectLoggingIntent(message);
        if (loggingIntent) {
            const logged = await this.handleLogging(userId, loggingIntent);
            if (logged) {
                // Add confirmation to context
                const peptide = loggingIntent.data.peptide as string;
                const dosage = loggingIntent.data.dosage;
                const unit = loggingIntent.data.unit;
                return this.callLLM(
                    systemPrompt + vaultContext + dynamicInstructions +
                    `\n\n### JUST LOGGED\nUser just logged: ${peptide} ${dosage}${unit}. Briefly confirm this was recorded and offer relevant advice.`,
                    message,
                    history
                );
            }
        }

        return this.callLLM(systemPrompt + vaultContext + dynamicInstructions, message, history);
    }

    protected detectLoggingIntent(message: string): LoggingIntent | null {
        const lower = message.toLowerCase();

        // Patterns: "took", "injected", "dosed", "administered", "had my", "just did"
        const dosePatterns = [
            // "took 250mcg BPC-157" or "took 250 mcg of BPC"
            /(?:took|injected|dosed|administered|had|did)\s+(\d+(?:\.\d+)?)\s*(mcg|mg|iu|units?)\s+(?:of\s+)?([a-z0-9-]+)/i,
            // "BPC-157 dose of 250mcg" or "BPC injection 250mcg"
            /([a-z0-9-]+)\s+(?:dose|injection|shot)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(mcg|mg|iu|units?)/i,
            // "250mcg BPC-157" at start of message (implicit took)
            /^(\d+(?:\.\d+)?)\s*(mcg|mg|iu|units?)\s+(?:of\s+)?([a-z0-9-]+)/i,
            // "my BPC dose" or "my sema shot" (need to infer from history)
            /(?:my|the)\s+([a-z0-9-]+)\s+(?:dose|shot|injection)/i,
        ];

        for (const pattern of dosePatterns) {
            const match = lower.match(pattern);
            if (match) {
                // Extract based on capture group order
                let peptide: string, dosage: number, unit: string;

                if (match[3] && !isNaN(parseFloat(match[1]))) {
                    // Pattern 1 or 3: dosage first, then unit, then peptide
                    dosage = parseFloat(match[1]);
                    unit = match[2].toLowerCase();
                    peptide = this.normalizePeptideName(match[3]);
                } else if (match[2] && !isNaN(parseFloat(match[2]))) {
                    // Pattern 2: peptide first, then dosage, then unit
                    peptide = this.normalizePeptideName(match[1]);
                    dosage = parseFloat(match[2]);
                    unit = match[3].toLowerCase();
                } else {
                    // Pattern 4: Just peptide mentioned (my BPC dose)
                    continue; // Skip - not enough info to log
                }

                // Normalize unit
                if (unit === 'unit' || unit === 'units') unit = 'iu';

                return {
                    type: 'peptide_dose',
                    data: {
                        peptide,
                        dosage,
                        unit,
                        timestamp: new Date().toISOString(),
                        timeOfDay: this.getTimeOfDay()
                    }
                };
            }
        }

        return null;
    }

    protected async handleLogging(userId: string, intent: LoggingIntent): Promise<boolean> {
        if (intent.type !== 'peptide_dose') return false;

        const { peptide, dosage, unit, timestamp, timeOfDay } = intent.data as {
            peptide: string;
            dosage: number;
            unit: string;
            timestamp: string;
            timeOfDay: string;
        };

        const date = new Date(timestamp);
        const localDate = date.toISOString().split('T')[0];
        const localTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        return this.writeToUserVault(userId, {
            csvFile: 'peptide_schedule.csv',
            csvRow: {
                timestamp,
                date: localDate,
                time: localTime,
                peptide,
                dosage: `${dosage}${unit}`,
                time_of_day: timeOfDay,
                notes: 'Logged via voice'
            }
        });
    }

    private normalizePeptideName(name: string): string {
        const lower = name.toLowerCase().replace(/[\s-]/g, '');
        return PEPTIDE_ALIASES[lower] || PEPTIDE_ALIASES[name.toLowerCase()] || name;
    }
}
