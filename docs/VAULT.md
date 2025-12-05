# Google Drive Vault System

## Overview

The Reset Biology Vault is a personal data storage system that syncs user activity to their own Google Drive. This keeps user data on THEIR infrastructure while allowing our AI agents to access historical data for personalized coaching.

**Key Principle:** We don't store user activity logs permanently on our servers - they flow to the user's Drive where they own their data.

---

## How It Works

### User Flow

1. User goes to `/profile` → Privacy tab
2. Clicks "Connect Google Drive"
3. Google OAuth consent screen appears
4. User approves `drive.file` scope (app can only access files it creates)
5. We create a folder structure in their Drive
6. All future activity syncs automatically

### Data Flow

```
User Action (log workout, meal, etc.)
    ↓
API Route saves to MongoDB (immediate)
    ↓
syncUserDataForDate() called
    ↓
Data formatted (Markdown + CSV)
    ↓
Uploaded to user's Drive folder
    ↓
Voice Agents can read CSV for context
```

---

## Folder Structure

When connected, this structure is created in the user's Drive:

```
📁 Reset Biology Data/
├── 📁 Journal/
│   └── journal-2025-01-15.md
├── 📁 Nutrition/
│   ├── nutrition-2025-01-15.md
│   └── nutrition_tracker.csv
├── 📁 Workouts/
│   └── workout-2025-01-15-abc123.md
├── 📁 Breath Sessions/
│   └── breath-2025-01-15-def456.md
├── 📁 Peptides/
│   ├── peptides-2025-01-15.md
│   └── peptide_schedule.csv
├── 📁 Vision Training/
│   ├── vision-2025-01-15-ghi789.md
│   └── vision_scores.csv
├── 📁 Memory Training/
│   ├── memory-2025-01-15-jkl012.md
│   └── memory_scores.csv
├── 📁 Profile/
│   └── user_preferences.json
└── 📁 Progress Reports/
    └── (future: weekly summaries)
```

### File Formats

- **Markdown (.md)** - Human-readable daily logs with formatting
- **CSV** - Machine-readable data for Voice Agent consumption
- **JSON** - Structured preference data

---

## Voice Agent Integration

Agents can access Drive data to provide personalized responses:

### Example: Bio-Coach Checking Nutrition

```typescript
// Agent retrieves today's nutrition from Drive
const nutritionCSV = await readFromVault(userId, 'Nutrition/nutrition_tracker.csv')
// Agent now knows: "You've had 1,800 calories today with 120g protein"
```

### Agent-to-Vault Logging

When users report actions via voice ("I just took my BPC-157"), agents can log directly:

```typescript
import { logToVault } from '@/lib/googleDriveService'

await logToVault(userId, 'peptide', {
  peptideName: 'BPC-157',
  dosage: 250,
  unit: 'mcg',
  time: '08:30 AM'
})
```

---

## Technical Details

### Environment Variables Required

```bash
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
NEXT_PUBLIC_BASE_URL=https://resetbiology.com
```

### OAuth Scopes

- `drive.file` - Create and access only files created by the app
- `userinfo.email` - Get user email for identification

**Note:** We cannot access ANY other files in the user's Drive.

### Database Fields (User model)

```prisma
googleDriveRefreshToken  String?   // OAuth refresh token
driveFolder              String?   // Root folder ID
drivePermissions         Json?     // Subfolder IDs for quick access
googleDriveConnectedAt   DateTime? // When connected
googleDriveSyncEnabled   Boolean   // Sync active flag
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrations/google-drive/connect` | GET | Start OAuth flow |
| `/api/integrations/google-drive/callback` | GET | Handle OAuth callback |
| `/api/integrations/google-drive/status` | GET | Check connection status |
| `/api/integrations/google-drive/disconnect` | POST | Revoke access |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/google-drive.ts` | Main sync service (838 lines) |
| `src/lib/googleDriveService.ts` | Legacy service with `logToVault` |
| `app/api/integrations/google-drive/*` | OAuth flow endpoints |
| `app/profile/page.tsx:374-445` | Connect/Disconnect UI |

---

## Sync Functions

### syncUserDataForDate(userId, date)

Syncs ALL user activity for a specific date:
- Journal entries
- Workout sessions
- Nutrition logs
- Peptide doses
- Breath sessions
- Vision training
- N-Back memory training

### syncUserProfile(userId)

Syncs user preferences to `Profile/user_preferences.json`

### Format Functions

- `formatJournalEntry()` - Markdown journal format
- `formatWorkoutSummary()` - Workout details with sets/reps
- `formatNutritionLog()` - Meals grouped by type with macros
- `formatPeptideDoses()` - Dose timing table
- `formatBreathSession()` - Breathing exercise details
- `formatVisionSession()` - Vision training results
- `formatNBackSession()` - Memory game scores

---

## Auto-Sync Triggers

Data syncs automatically when users complete activities:

| Activity | API Route | Sync Triggered |
|----------|-----------|----------------|
| Log workout | `/api/workout/sessions` POST | ✅ |
| Log meal | `/api/nutrition/entries` POST | ✅ |
| Log peptide dose | `/api/peptides/doses` POST | ✅ |
| Complete breath session | `/api/breath/sessions` POST | ✅ |
| Complete vision training | `/api/vision/sessions` POST | ✅ |
| Complete N-Back game | `/api/nback/sessions` POST | ✅ |

---

## Troubleshooting

### "Google Drive integration not configured"
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel env vars
- Ensure `NEXT_PUBLIC_BASE_URL` is set to `https://resetbiology.com`

### OAuth redirect error
- Verify redirect URI in Google Cloud Console matches:
  `https://resetbiology.com/api/integrations/google-drive/callback`

### No refresh token received
- User may have previously connected. Revoke access in Google Account settings, then retry.
- Or: Delete app permission at https://myaccount.google.com/permissions

### Files not syncing
- Check `googleDriveSyncEnabled` is `true` in user record
- Verify `driveFolder` ID exists
- Check API route is calling `syncUserDataForDate()`

---

## Security Notes

1. **Refresh tokens are stored in MongoDB** - Consider encryption for production
2. **drive.file scope limits access** - We can ONLY touch files we created
3. **User can revoke anytime** - Via Profile page or Google Account settings
4. **Files remain on disconnect** - We don't delete their data when they disconnect

---

## Future Enhancements

- [ ] Weekly progress report generation
- [ ] Photo uploads for food logging
- [ ] Voice journal transcription storage
- [ ] Encrypted token storage
- [ ] Background sync jobs (cron)
