# Vision Training PRD - Reset Biology

## Overview
The Vision Training page (`/vision-healing`) provides a 12-week program for vision improvement with daily exercises, a Snellen chart trainer, and progress tracking.

## Current Issues to Test and Fix

### Critical Issues

#### 1. Snellen Trainer Device Icon Bug
**Current Behavior:** The "Vision Type" selector shows:
- Near vision: Phone icon (📱)
- Far vision: Desktop icon (🖥️)

**Problem:** The icons are tied to VISION TYPE, not DEVICE MODE. When user selects "Phone" in Device Mode but "Far" in Vision Type, they see a desktop icon - this is confusing.

**Expected Behavior:** Icons should reflect the DEVICE MODE selection, not vision type:
- If Device Mode = Phone: show phone icon for both Near and Far
- If Device Mode = Desktop: show desktop icon for both Near and Far

**Location:** `src/components/Vision/VisionHealing.tsx` lines 240-258

#### 2. Distance Language Issues
**Problem:** Multiple places reference unrealistic distances like:
- "Desktop: aim ~80cm; TV: 2–3m"
- "Use a TV/monitor at 2–3m for far checks"

**Why This Is Wrong:**
- Users cannot interact with keyboard/buttons from 2-3 meters away
- Until voice/audio controls are added, all distances must be within arm's reach
- Current distance guidance is misleading for phone users

**Files to Scrub:**
- `src/components/Vision/Training/DistanceGuidance.tsx` - lines 24-26, 87-89
- `src/components/Vision/Training/SnellenChart.tsx` - lines 135-141
- `src/components/Vision/Training/TrainingSession.tsx` - any far distance references

**Expected Behavior:**
- Phone mode: All distances should be arm's length or less (20-60cm)
- Desktop mode: Distances should be desk-appropriate (60-100cm max)
- Remove ALL references to 2m, 3m, 6ft, 10ft until audio controls exist

#### 3. Missing Lesson History / 12-Week Plan View
**Problem:** Users cannot:
- See which lessons they've completed vs missed
- View the overarching 12-week curriculum plan
- Mark past lessons as complete retroactively
- Make up missed lessons

**Expected Features:**
- Calendar view showing completed/missed days
- Ability to click any past day and mark exercises as done
- Full 12-week curriculum overview with completion status
- "Make up this lesson" button for missed days

**Location:** Need to add to `CurriculumOverview.tsx` and potentially new `LessonHistory.tsx` component

### UI/Navigation Issues

#### 4. Redundant Navigation Elements
**Current State:** The vision-healing page may have duplicate headers or navigation bars (similar to breath page issue)

**Test:** Verify single header, single nav bar, no duplicate titles

#### 5. Tab State Persistence
**Test:** When switching tabs (Curriculum, Today's Session, Quick Practice, Snellen Trainer, Progress), verify:
- State is preserved when switching away and back
- No data loss on tab switches
- Loading states display correctly

### Functional Tests

#### 6. Snellen Chart Functionality
**Test Cases:**
- Letters mode: All 10 letters (E, F, P, T, O, Z, L, P, E, D) display correctly
- E-directional mode: All 4 directions work (up, down, left, right)
- Answer buttons register correct/incorrect properly
- Level progression works (advances after 10 attempts with required accuracy)
- Session data saves to database

#### 7. Distance Progression for Near Vision
**Test Cases:**
- Starting distance is appropriate for device mode
- Distance increases after successful attempts
- Reader glasses stages unlock properly
- Voice feedback works ("Correct!", "Try again", etc.)

#### 8. Enrollment Flow
**Test Cases:**
- Unenrolled users see limited tabs
- Enroll button works and switches to "Today's Session"
- Enrolled users see all tabs
- Enrollment persists across page reloads

#### 9. Daily Practice
**Test Cases:**
- Shows correct exercises for current week/day
- Exercise completion tracks properly
- Points awarded for completion

#### 10. Progress Dashboard
**Test Cases:**
- Displays session history
- Shows accuracy trends
- Level progression visible

## Component Structure

```
/vision-healing (page.tsx)
└── VisionHealing.tsx
    ├── PortalHeader
    ├── Tab Navigation
    ├── CurriculumOverview.tsx (12-week plan)
    ├── DailyPractice.tsx (today's exercises)
    ├── QuickPractice.tsx (individual exercises)
    │   └── GuidedExercise.tsx
    ├── TrainingSession.tsx (Snellen trainer)
    │   ├── SnellenChart.tsx
    │   └── DistanceGuidance.tsx
    └── ProgressDashboard.tsx
```

## API Endpoints to Test

- `GET /api/vision/program` - Check enrollment status
- `POST /api/vision/program` - Enroll in program
- `GET /api/vision/sessions` - Get session history
- `POST /api/vision/sessions` - Save session data
- `GET /api/vision/curriculum` - Get curriculum data

## Browser/Device Testing

### Required Tests:
1. Desktop Chrome (primary)
2. Mobile Safari (iOS)
3. Mobile Chrome (Android)

### Responsive Breakpoints:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## Success Criteria

1. No duplicate headers or navigation elements
2. Device icons match selected device mode, not vision type
3. All distance references are realistic for the device mode
4. Users can view and edit their 12-week progress
5. Snellen trainer works correctly for both chart types
6. Session data persists correctly
7. No console errors during normal usage
