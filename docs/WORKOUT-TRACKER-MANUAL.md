# Workout Tracker User Manual

**Version:** 1.0.0
**Last Updated:** November 15, 2025
**Page:** `/workout`

---

## Overview

The Workout Tracker is a comprehensive protocol-driven training system that allows users to:
- Assign structured workout protocols from a curated library
- Track workout sessions with detailed exercise logging
- Monitor readiness and recovery metrics
- View workout history and progress

---

## Getting Started

### Accessing the Workout Tracker

1. Navigate to **`https://resetbiology.com/workout`**
2. Ensure you're logged in with your Auth0 account
3. The tracker will load your active protocols and recent sessions

---

## Key Features

### 1. Protocol Assignment System

**What it does:** Assigns pre-programmed workout protocols with structured phases, sessions, and exercises.

**How to use:**
1. Click **"Protocol Library"** button
2. Browse available protocols by:
   - Training level (Beginner, Intermediate, Advanced)
   - Focus areas (Strength, Mobility, Endurance, etc.)
   - Duration (weeks)
3. Click on a protocol to view details:
   - Summary and goals
   - Phase breakdown
   - Session structure
   - Equipment needed
4. Click **"Assign Protocol"** to add it to your active plan
5. Optionally personalize:
   - Start date
   - Available equipment
   - Session time preference (morning/midday/evening)
   - Mobility constraints

**What you'll see:**
- Active protocol card showing current phase and session
- Progress bar indicating completion percentage
- Next scheduled session details

---

### 2. Session Logging

**What it does:** Records completed workout sessions with exercise details.

**How to use:**

#### Quick Log (Manual Entry):
1. Click **"Log Session"** or **"Quick Log"**
2. Select exercises from the library
3. Enter sets, reps, weight, tempo, rest time
4. Add optional session notes
5. Click **"Save Session"**

#### Protocol Session (From Assignment):
1. View your active protocol's current session
2. Click **"Mark Session Complete"**
3. System auto-logs the prescribed exercises
4. Optionally edit sets/reps/weight if you adjusted on the fly
5. Add session notes (how it felt, modifications made)
6. Click **"Complete & Log"**

**What gets saved:**
- Exercise list with full details
- Total duration
- Session date/time
- Notes and modifications
- Link to protocol (if from assignment)

---

### 3. Readiness Check-In

**What it does:** Tracks recovery metrics to guide training intensity.

**How to use:**
1. Click **"Daily Check-In"** or **"Log Readiness"**
2. Rate the following (1-10 scale):
   - **Readiness Score**: Overall readiness to train
   - **Energy Level**: Mental and physical energy
   - **Soreness Level**: Muscle soreness/fatigue
   - **Sleep Hours**: Hours of sleep last night
   - **Stress Level**: Perceived stress
   - **Mood**: General mood (dropdown)
3. Add optional notes
4. Click **"Submit Check-In"**

**What it's used for:**
- Adjusting protocol intensity
- Identifying overtraining patterns
- Tracking recovery trends
- Personalizing session recommendations

---

### 4. Workout History

**What it does:** Displays all past workout sessions with filtering and search.

**How to use:**
1. Scroll to **"Recent Sessions"** or **"Workout History"** section
2. View summary cards showing:
   - Date and time
   - Protocol name (if applicable)
   - Exercise count and total volume
   - Duration
3. Click on a session to expand details:
   - Full exercise list with sets/reps/weight
   - Session notes
   - Readiness metrics (if logged that day)
4. Filter by:
   - Date range
   - Protocol
   - Exercise type
5. Search for specific exercises

---

### 5. Protocol Management

**What it does:** Manage active and archived protocol assignments.

**How to use:**

#### View Active Protocols:
- See all currently assigned protocols in the main view
- Each shows current session, progress, and next scheduled workout

#### Pause a Protocol:
1. Click on active protocol card
2. Click **"Pause Protocol"**
3. Confirm action
4. Protocol moves to "Paused" status (progress saved)

#### Resume a Protocol:
1. View paused protocols list
2. Click **"Resume"** on desired protocol
3. Choose restart date
4. Protocol becomes active again

#### Archive a Protocol:
1. Click on completed or paused protocol
2. Click **"Archive"**
3. Protocol moves to history (read-only)

---

## Design & Styling

The Workout Tracker follows Reset Biology's brand guidelines:

### Color Palette
- **Primary Teal:** `#3FBFB5` - Used for buttons, accents, highlights
- **Secondary Green:** `#72C247` - Used for success states, progress indicators
- **Background:** Dark gradients (`slate-950`, `slate-900`) with transparency
- **Card Backgrounds:** `bg-primary-500/20` or `bg-secondary-500/10` with `backdrop-blur-sm`

### Transparency Standards
- **Cards:** `/20` or `/30` opacity maximum
- **Overlays:** Always paired with `backdrop-blur-sm`
- **Modals:** `bg-black/50 backdrop-blur-sm` for overlay

### Typography
- **Headers:** `text-xl` to `text-3xl`, `font-semibold`
- **Body:** `text-sm` to `text-base`
- **Labels:** `text-xs uppercase tracking-[0.3em]`
- **Mobile minimum:** 12px font size

### Responsive Breakpoints
- **Mobile:** 375px - 767px (full-width cards, stacked layout)
- **Tablet:** 768px - 1023px (2-column grid)
- **Desktop:** 1024px+ (3-column grid, side-by-side sections)

---

## Common Use Cases

### Scenario 1: Starting a New Protocol
1. Click "Protocol Library"
2. Filter by your level (e.g., "Intermediate")
3. Choose "Strength & Mobility Foundation" protocol
4. Click "Assign Protocol"
5. Set start date to tomorrow
6. Enter available equipment: "Dumbbells, Resistance Bands"
7. Choose session time: "Morning"
8. Click "Assign"
9. View your first session in the "Active Protocol" card

### Scenario 2: Logging Today's Workout
1. Open Workout Tracker
2. See today's prescribed session in "Active Protocol"
3. Complete the workout
4. Click "Mark Session Complete"
5. Adjust any reps/weights that you modified
6. Add note: "Felt strong, increased weight on squats"
7. Click "Complete & Log"
8. Session appears in history, protocol progress updates

### Scenario 3: Tracking Recovery
1. Every morning, click "Daily Check-In"
2. Rate readiness: 7/10
3. Rate energy: 8/10
4. Rate soreness: 4/10
5. Enter sleep: 7.5 hours
6. Rate stress: 3/10
7. Select mood: "Energized"
8. Click "Submit Check-In"
9. View readiness trend over time in history

---

## Troubleshooting

### "Protocol not loading"
- **Cause:** Network timeout or session expired
- **Fix:** Refresh the page, check internet connection, re-login if needed

### "Session won't save"
- **Cause:** Missing required fields (exercise, sets, or date)
- **Fix:** Ensure all required fields are filled, check for form validation errors

### "History not showing old sessions"
- **Cause:** Date filter applied or sessions logged to different account
- **Fix:** Reset date filters, verify logged into correct Auth0 account

### "Mobile layout broken"
- **Cause:** Browser compatibility or cached CSS
- **Fix:** Clear browser cache, try Chrome/Safari, hard refresh (Ctrl+Shift+R)

---

## Best Practices

1. **Log readiness daily** - Do check-ins first thing in the morning before training
2. **Be honest with ratings** - Accurate data = better protocol adjustments
3. **Add session notes** - Capture how exercises felt, modifications made, injuries
4. **Review progress weekly** - Check protocol progress and readiness trends
5. **Don't skip rest days** - Follow the protocol's prescribed recovery schedule

---

## Data Privacy

- All workout data is stored securely in MongoDB Atlas
- Data is tied to your Auth0 user account
- Only you can view your workout history
- Admins can view aggregate anonymized data for research purposes

---

## Support

For issues or questions:
- **GitHub Issues:** https://github.com/jonchyatt/resetbiology/issues
- **Documentation:** `/docs` folder in repository
- **Design System:** See `tests/design-system-validation.spec.ts`

---

## Roadmap

**Upcoming Features:**
- Exercise video demonstrations
- AI-powered form analysis (camera integration)
- Progressive overload recommendations
- Workout sharing with coaches
- Apple Health / Google Fit sync
- Voice-guided workout sessions
