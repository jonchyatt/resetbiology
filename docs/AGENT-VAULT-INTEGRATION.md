# Agent-Vault Integration: Comprehensive Implementation Plan

> **Purpose**: Enable AI agents to read from and write to user's Google Drive Vault, creating personalized, context-aware coaching experiences while maintaining performance and privacy.

> **Last Updated**: December 5, 2025

---

## Executive Summary

This plan transforms our 11 stateless AI agents into context-aware coaches that remember each user's history. By partitioning the Google Drive Vault and loading only relevant slices into agent context, we achieve personalization without latency bloat.

**The Core Insight**: Each agent only needs its domain's data. The Peptide Agent doesn't need workout history. The Nutrition Agent doesn't need vision scores. Partition-aware loading keeps context small and responses fast.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER VOICE INPUT                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT ORCHESTRATOR                           │
│  1. Identify agent from page context                            │
│  2. Check if user has Drive connected                           │
│  3. If yes → Load relevant vault partition                      │
│  4. Inject context + route to agent                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SPECIALIZED AGENT                           │
│  - System prompt (static)                                        │
│  - Dynamic training (from DB)                                    │
│  - Vault context (from Drive) ← NEW                             │
│  - User message                                                  │
│  - Conversation history                                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RESPONSE + LOGGING                          │
│  1. Agent generates response                                     │
│  2. Detect logging intent ("I took...", "I ate...")            │
│  3. If logging → Write to vault partition                       │
│  4. Return voice response to user                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Vault Partition Strategy

### Folder-to-Agent Mapping

| Vault Folder | Primary Agent | Secondary Access | Data Format |
|--------------|---------------|------------------|-------------|
| `/Peptides/` | PeptideAgent | Concierge | CSV + MD |
| `/Nutrition/` | NutritionAgent | Concierge | CSV + MD |
| `/Workouts/` | ExerciseAgent | Concierge | MD files |
| `/Breath Sessions/` | BreathAgent | Concierge | MD files |
| `/Vision Training/` | VisionTutor | Concierge | CSV + MD |
| `/Memory Training/` | NBackAgent | Concierge | CSV + MD |
| `/Journal/` | JournalAgent | Professor | MD files |
| `/Profile/` | ALL AGENTS | - | JSON |
| `/Progress Reports/` | Concierge | - | MD summaries |

### Why This Partitioning Works

1. **Domain Isolation**: Peptide data stays with Peptide Agent
2. **Minimal Context**: Each agent loads ~500-2000 chars max
3. **Fast Reads**: Single folder, single file pattern
4. **Privacy Principle**: Agent only sees what it needs
5. **Scalability**: Adding new agents = adding new partitions

---

## Data Format Standards

### CSV Files (Machine-Readable)
For agents to parse and reference:

```csv
# peptide_schedule.csv
timestamp,peptide,dosage,unit,time_of_day,notes
2025-12-05T08:30:00Z,BPC-157,250,mcg,morning,empty stomach
2025-12-04T08:15:00Z,BPC-157,250,mcg,morning,
2025-12-03T20:00:00Z,TB-500,2.5,mg,evening,loading phase
```

```csv
# nutrition_tracker.csv
timestamp,food,calories,protein,carbs,fats,meal_type
2025-12-05T12:30:00Z,Chicken breast,280,52,0,6,lunch
2025-12-05T12:30:00Z,Brown rice,215,5,45,2,lunch
2025-12-05T08:00:00Z,Eggs (3),210,18,0,15,breakfast
```

### Markdown Files (Human-Readable)
For detailed session logs:

```markdown
# Workout - December 5, 2025

**Duration:** 45 minutes
**Type:** Upper Body Push

## Exercises
- Bench Press: 185x8, 185x8, 185x7
- OHP: 115x10, 115x10, 115x8
- Dips: BWx12, BWx12, BWx10

## Notes
Felt strong today. Increased bench by 5lbs.
```

### JSON Files (Structured Data)
For profile and preferences:

```json
{
  "name": "Jonathan",
  "goals": ["fat loss", "cognitive enhancement"],
  "currentProtocols": ["semaglutide", "BPC-157"],
  "dietaryPreferences": ["high protein", "intermittent fasting"],
  "timezone": "America/New_York",
  "preferredWorkoutTime": "morning"
}
```

---

## API Design: Vault Read/Write

### `readFromVault(userId, options)`

```typescript
interface VaultReadOptions {
  // REQUIRED: Which partition to read
  folder: 'Peptides' | 'Nutrition' | 'Workouts' | 'Breath Sessions' |
          'Vision Training' | 'Memory Training' | 'Journal' | 'Profile';

  // OPTIONAL: Filter what to read
  filePattern?: string;      // e.g., "*.csv", "peptide_schedule.csv"

  // OPTIONAL: Time-based filtering (for CSV files)
  lastNDays?: number;        // Only rows from last N days (default: 7)

  // OPTIONAL: Row-based filtering (for CSV files)
  lastNRows?: number;        // Only last N rows (default: 50)

  // OPTIONAL: Size limiting
  maxChars?: number;         // Truncate output (default: 2000)

  // OPTIONAL: Format preference
  format?: 'raw' | 'summary'; // 'summary' = LLM-friendly prose
}

// Returns
interface VaultReadResult {
  success: boolean;
  data: string;              // The context to inject
  charCount: number;         // How much was loaded
  truncated: boolean;        // Was data cut off?
  source: string;            // Which file(s) were read
  error?: string;
}
```

### `writeToVault(userId, options)`

```typescript
interface VaultWriteOptions {
  // REQUIRED
  folder: string;

  // For CSV append
  csvFile?: string;          // e.g., "peptide_schedule.csv"
  csvRow?: Record<string, any>;

  // For MD file creation
  mdFile?: string;           // e.g., "workout-2025-12-05.md"
  mdContent?: string;

  // For JSON update
  jsonFile?: string;         // e.g., "user_preferences.json"
  jsonData?: Record<string, any>;
  jsonMerge?: boolean;       // Merge with existing or replace
}
```

---

## Agent Implementation Pattern

### Base Pattern (Add to BaseAgent)

```typescript
// src/lib/agents/BaseAgent.ts

abstract class BaseAgent {
  // Existing methods...

  // NEW: Load vault context before generating response
  protected async loadVaultContext(userId: string): Promise<string> {
    const partition = this.getVaultPartition(); // Override in subclass
    if (!partition) return '';

    try {
      const result = await readFromVault(userId, {
        folder: partition,
        lastNDays: 7,
        maxChars: 1500,
        format: 'summary'
      });

      if (result.success && result.data) {
        return `\n\n### USER'S RECENT ${partition.toUpperCase()} HISTORY\n${result.data}\n`;
      }
    } catch (error) {
      // Graceful degradation - agent works without vault
      console.log(`[${this.constructor.name}] Vault read skipped:`, error);
    }
    return '';
  }

  // Override in subclasses
  protected getVaultPartition(): string | null {
    return null;
  }

  // NEW: Detect and handle logging intents
  protected detectLoggingIntent(message: string): LoggingIntent | null {
    // Override in subclasses with domain-specific patterns
    return null;
  }

  protected async handleLogging(userId: string, intent: LoggingIntent): Promise<void> {
    // Override in subclasses
  }
}
```

### Peptide Agent Example

```typescript
// src/lib/agents/PeptideAgent.ts

export class PeptideAgent extends BaseAgent {

  protected getVaultPartition(): string {
    return 'Peptides';
  }

  async generateResponse(userId: string, message: string, history: any[]): Promise<string> {
    const systemPrompt = `...existing prompt...`;

    // NEW: Load user's peptide history from vault
    const vaultContext = await this.loadVaultContext(userId);

    const dynamicTraining = await this.loadDynamicTraining(userId, 'PEPTIDE');

    // Check for logging intent
    const loggingIntent = this.detectLoggingIntent(message);
    if (loggingIntent) {
      await this.handleLogging(userId, loggingIntent);
    }

    // Combine all context
    const fullPrompt = systemPrompt + vaultContext + dynamicTraining;

    return this.callLLM(fullPrompt, message, history);
  }

  protected detectLoggingIntent(message: string): LoggingIntent | null {
    const lowerMsg = message.toLowerCase();

    // Patterns: "took", "injected", "dosed", "administered"
    const dosePatterns = [
      /(?:took|injected|dosed|administered|had)\s+(\d+)\s*(mcg|mg|iu)\s+(?:of\s+)?(\w+[-\w]*)/i,
      /(\w+[-\w]*)\s+(?:dose|injection)\s+(?:of\s+)?(\d+)\s*(mcg|mg|iu)/i
    ];

    for (const pattern of dosePatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          type: 'peptide_dose',
          data: {
            peptide: this.normalizePeptideName(match[3] || match[1]),
            dosage: parseFloat(match[1] || match[2]),
            unit: match[2] || match[3],
            timestamp: new Date().toISOString()
          }
        };
      }
    }
    return null;
  }

  protected async handleLogging(userId: string, intent: LoggingIntent): Promise<void> {
    await writeToVault(userId, {
      folder: 'Peptides',
      csvFile: 'peptide_schedule.csv',
      csvRow: {
        timestamp: intent.data.timestamp,
        peptide: intent.data.peptide,
        dosage: intent.data.dosage,
        unit: intent.data.unit,
        time_of_day: this.getTimeOfDay(),
        notes: ''
      }
    });
  }

  private normalizePeptideName(name: string): string {
    const aliases: Record<string, string> = {
      'bpc': 'BPC-157',
      'bpc157': 'BPC-157',
      'tb500': 'TB-500',
      'tb': 'TB-500',
      'sema': 'Semaglutide',
      'semaglutide': 'Semaglutide',
      'ipa': 'Ipamorelin',
      'cjc': 'CJC-1295',
      'ghk': 'GHK-Cu'
    };
    return aliases[name.toLowerCase()] || name;
  }
}
```

---

## Context Injection Examples

### What PeptideAgent Sees

```
### ROLE
You are the Peptide Protocol Specialist for Reset Biology...

### USER'S RECENT PEPTIDES HISTORY
Last 7 days of doses:
- Dec 5, 8:30am: BPC-157 250mcg (morning, empty stomach)
- Dec 4, 8:15am: BPC-157 250mcg (morning)
- Dec 3, 8:00pm: TB-500 2.5mg (evening, loading phase)
- Dec 3, 8:20am: BPC-157 250mcg (morning)
- Dec 2, 8:30am: BPC-157 250mcg (morning)

Current protocol: BPC-157 daily AM, TB-500 2x/week evenings

### DYNAMIC TRAINING
[Admin-configured training content]

### USER MESSAGE
"Should I take my BPC today? I'm feeling a bit nauseous."
```

### What NutritionAgent Sees

```
### ROLE
You are the Nutrition Coach for Reset Biology...

### USER'S RECENT NUTRITION HISTORY
Today's intake (Dec 5):
- Breakfast: 3 eggs (210 cal, 18g protein)
- Lunch: Chicken + rice (495 cal, 57g protein)
Total so far: 705 cal, 75g protein, 45g carbs, 23g fat

Yesterday's totals: 1,850 cal, 165g protein
Weekly average: 1,920 cal/day, 158g protein/day

### USER MESSAGE
"What should I have for dinner to hit my protein goal?"
```

---

## Performance Considerations

### Latency Budget

| Operation | Target | Max |
|-----------|--------|-----|
| Check Drive connection | 50ms | 100ms |
| Read vault partition | 200ms | 500ms |
| LLM response | 800ms | 2000ms |
| Write to vault | 150ms | 300ms |
| **Total voice response** | **1200ms** | **2900ms** |

### Caching Strategy

```typescript
// Cache vault reads for 5 minutes per user per partition
const vaultCache = new Map<string, { data: string; timestamp: number }>();

function getCacheKey(userId: string, partition: string): string {
  return `${userId}:${partition}`;
}

async function readFromVaultCached(userId: string, options: VaultReadOptions): Promise<VaultReadResult> {
  const key = getCacheKey(userId, options.folder);
  const cached = vaultCache.get(key);

  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return { success: true, data: cached.data, charCount: cached.data.length, truncated: false, source: 'cache' };
  }

  const result = await readFromVault(userId, options);
  if (result.success) {
    vaultCache.set(key, { data: result.data, timestamp: Date.now() });
  }
  return result;
}
```

### Graceful Degradation

If vault read fails:
1. Log the error
2. Continue without vault context
3. Agent still works with static knowledge
4. User experience not blocked

```typescript
const vaultContext = await this.loadVaultContext(userId).catch(() => '');
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Day 1)
- [ ] Create `src/lib/vaultService.ts` with `readFromVault()` and `writeToVault()`
- [ ] Add CSV parsing/filtering utilities
- [ ] Add caching layer
- [ ] Write unit tests

### Phase 2: BaseAgent Enhancement (Day 1)
- [ ] Add `loadVaultContext()` to BaseAgent
- [ ] Add `getVaultPartition()` abstract method
- [ ] Add `detectLoggingIntent()` pattern
- [ ] Add `handleLogging()` pattern

### Phase 3: Agent Updates (Day 2)
- [ ] PeptideAgent: Read doses, detect "took X" logging
- [ ] NutritionAgent: Read meals, detect "ate X" logging
- [ ] ExerciseAgent: Read workouts, detect "did X" logging
- [ ] BreathAgent: Read sessions, detect completion logging
- [ ] VisionTutor: Already has logging, add reading
- [ ] NBackAgent: Read scores, add logging

### Phase 4: Testing & Polish (Day 2-3)
- [ ] Test each agent with real vault data
- [ ] Verify logging creates correct CSV rows
- [ ] Check latency stays under budget
- [ ] Test graceful degradation (no Drive connected)

### Phase 5: Documentation (Day 3)
- [ ] Update VAULT.md with agent integration
- [ ] Update SpecializedAgents.md with vault capabilities
- [ ] Add admin guide for training agents with vault awareness

---

## Logging Intent Patterns by Agent

### PeptideAgent
```
Triggers: "took", "injected", "dosed", "administered", "had my"
Examples:
- "I took 250mcg BPC-157 this morning"
- "Just injected my TB-500"
- "Had my semaglutide dose"
```

### NutritionAgent
```
Triggers: "ate", "had", "for breakfast/lunch/dinner", "just finished"
Examples:
- "I had eggs and bacon for breakfast"
- "Just ate a chicken salad, about 400 calories"
- "Had a protein shake"
```

### ExerciseAgent
```
Triggers: "did", "completed", "finished", "worked out", "trained"
Examples:
- "Just finished a 45 minute upper body workout"
- "Did 3 sets of bench at 185"
- "Completed my leg day"
```

### BreathAgent
```
Triggers: "finished", "completed", "did X rounds"
Examples:
- "Just finished 3 rounds of Wim Hof"
- "Did my morning breathwork"
- "Completed a 10 minute session"
```

---

## Security & Privacy Notes

1. **Drive Scope**: We use `drive.file` - can ONLY access files we created
2. **User Consent**: OAuth flow requires explicit approval
3. **Data Locality**: Data stays on USER'S Drive, not our servers
4. **Partition Isolation**: Agents only see their domain's data
5. **No Cross-User Access**: Each user's vault is completely separate
6. **Revocable**: User can disconnect Drive anytime from `/profile`

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Context load time | <300ms | Instrument `readFromVault` |
| Logging accuracy | >90% | Review logged vs actual |
| User satisfaction | Qualitative | "Did the agent know my history?" |
| Cache hit rate | >70% | Track cache hits/misses |
| Graceful degradation | 100% | Agent works without Drive |

---

## Files to Create/Modify

### New Files
- `src/lib/vaultService.ts` - Core read/write functions
- `src/lib/vaultCache.ts` - Caching layer
- `src/lib/vaultParsers.ts` - CSV/MD parsing utilities

### Modified Files
- `src/lib/agents/BaseAgent.ts` - Add vault integration methods
- `src/lib/agents/PeptideAgent.ts` - Add read + write
- `src/lib/agents/NutritionAgent.ts` - Add read + write
- `src/lib/agents/ExerciseAgent.ts` - Add read + write
- `src/lib/agents/BreathAgent.ts` - Add read + write
- `src/lib/agents/VisionTutor.ts` - Add read (already has write)
- `src/lib/agents/NBackAgent.ts` - Add read + write
- `src/lib/agents/JournalAgent.ts` - Add read + write
- `src/lib/agents/AgentOrchestrator.ts` - Check Drive connection

---

## Quick Reference: Key Functions

```typescript
// Read user's peptide history
const context = await readFromVault(userId, {
  folder: 'Peptides',
  filePattern: 'peptide_schedule.csv',
  lastNDays: 7,
  maxChars: 1500
});

// Write a new peptide dose
await writeToVault(userId, {
  folder: 'Peptides',
  csvFile: 'peptide_schedule.csv',
  csvRow: { timestamp, peptide, dosage, unit, time_of_day, notes }
});

// Read user's profile
const profile = await readFromVault(userId, {
  folder: 'Profile',
  filePattern: 'user_preferences.json'
});
```

---

## Next Steps After /compact

1. Read this document: `docs/AGENT-VAULT-INTEGRATION.md`
2. Start with Phase 1: Create `src/lib/vaultService.ts`
3. Test with one agent (PeptideAgent) before expanding
4. Commit after each phase works

---

*This plan created December 5, 2025. The goal is brilliant, clean, context-aware AI coaching.*
