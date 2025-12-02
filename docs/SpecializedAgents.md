# Specialized Voice Agents System

## Overview

The Reset Biology platform now features **11 specialized AI agents**, each an expert in their domain. This architecture provides:

1. **Faster responses** - No intent classification needed when page context is known
2. **Better accuracy** - Each agent has focused, domain-specific knowledge
3. **Smaller training files** - ~500 chars per agent instead of bloated global training
4. **Easier maintenance** - Update one agent without affecting others

---

## Agent Roster

| Agent ID | Name | Specialization | Activated On Page |
|----------|------|----------------|-------------------|
| `CONCIERGE` | Concierge | General help, routing to specialists | `/portal` |
| `PEPTIDE` | Peptide Specialist | Dosing, timing, side effects, reconstitution | `/peptides` |
| `EXERCISE` | Exercise Physiologist | Workouts, form, programming, recovery | `/workout` |
| `NUTRITION` | Nutrition Coach | Diet, macros, fasting, supplements | `/nutrition` |
| `BREATH` | Breath Coach | Breathwork, stress, vagal tone | `/breathe` |
| `JOURNAL` | Reflection Guide | Journaling, emotional processing | `/journal` |
| `VISION` | Vision Tutor | 12-week program, eye exercises | `/vision` |
| `NBACK` | Cognitive Trainer | N-Back, mental training | `/nback` |
| `COURSE` | Course Guide | Lessons, modules, progress | `/modules` |
| `PROFESSOR` | The Professor | Science, mechanisms, research | (via routing) |
| `SALES` | Sales | Pricing, objections, signup | `/order` |

---

## How Routing Works

### Page-Aware Routing (Fastest)
When a user clicks the mic button on a specific page:
1. Frontend sends `pageContext` (e.g., `/peptides`) with the audio
2. Backend maps page to agent directly (no LLM call)
3. Agent responds immediately

**Latency savings**: ~0.5-1s (skips intent classification)

### Intent Classification (Fallback)
If no page context provided (e.g., from `/specialists` page):
1. Small LLM call classifies intent
2. Routes to appropriate agent
3. Agent responds

---

## File Structure

```
src/lib/agents/
├── BaseAgent.ts          # Base class with LLM calls and training loader
├── AgentOrchestrator.ts  # Routes messages to correct agent
├── PeptideAgent.ts       # Peptide dosing, timing, side effects
├── ExerciseAgent.ts      # Workouts, form, recovery
├── NutritionAgent.ts     # Diet, macros, fasting
├── BreathAgent.ts        # Breathwork, vagal tone
├── JournalAgent.ts       # Reflection, emotional processing
├── VisionTutor.ts        # 12-week vision program
├── NBackAgent.ts         # Cognitive training
├── CourseAgent.ts        # Course/module navigation
├── Professor.ts          # Science questions
├── SalesCloser.ts        # Pricing, objections
└── BioCoach.ts           # Legacy (now routes to Nutrition)
```

---

## Training Agents

### Admin Interface
Go to: `https://resetbiology.com/admin/agents`

Select an agent, paste training content, click Save.

### Training Best Practices

1. **Keep it short** (~500 chars max per agent)
   - More training = slower responses

2. **Structure with priority**
   ```
   ### IRONCLAD RULES (Never Break)
   - Rule 1
   - Rule 2

   ### SPEECH PATTERNS
   - Key phrases to use

   ### KNOWLEDGE
   - Product/domain facts
   ```

3. **Position matters** - Put critical rules first

4. **Examples beat descriptions**
   - Bad: "Be friendly"
   - Good: "Start with 'Hey there! Let me help with that.'"

---

## API Endpoints

### Voice Chat
`POST /api/voice/chat`

Form data:
- `audio` - WebM audio file
- `pageContext` - (optional) Current page path for direct routing

Response headers:
- `X-Agent-Type` - Which agent responded
- `X-Agent-Response-Text` - Text of response

### Training Management
`GET /api/agents/training?agent=PEPTIDE`
- Returns current training for an agent

`POST /api/agents/training`
- Body: `{ agentId: "PEPTIDE", training: "..." }`
- Saves training to database

---

## Pages Created

### `/specialists`
Grid of all specialist cards. Click a specialist to navigate to their page, then use voice.

### `/admin/agents`
Training center for all 11 agents. Select agent, edit training, save.

---

## Speed Optimizations Applied

1. **Model**: `gpt-4o-mini` (3x faster than gpt-4o)
2. **Max tokens**: 150 (forces concise 2-3 sentence responses)
3. **Page routing**: Skips intent classification when page known
4. **Voice brevity prompt**: Added to all agents

---

## Database Schema

```prisma
model AgentTraining {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  agentId   String   // "PEPTIDE", "VISION", etc.
  userId    String   @db.ObjectId
  content   String   // The training text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([agentId, userId])
  @@map("agent_trainings")
}
```

---

## Testing

1. Go to `/peptides` page
2. Click mic button
3. Ask a peptide question
4. Should respond as Peptide Specialist (check console for `[VoiceAPI] Agent (PEPTIDE)`)

5. Go to `/vision` page
6. Ask a vision question
7. Should respond as Vision Tutor

8. Go to `/specialists`
9. Click "The Professor"
10. Ask a science question (routes via intent classification)

---

## Future Enhancements

1. **Conversation history** - Persist between sessions
2. **Agent switching** - "Let me transfer you to our Peptide Specialist"
3. **Multi-modal** - Agents that can see images (food logging, form check)
4. **Voice customization** - Different TTS voices per agent persona
