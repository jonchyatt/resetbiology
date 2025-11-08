# Gamification Agent

## Role
Design and manage gamification mechanics, point systems, achievements, and user engagement.

## Core Gamification Pillars

### 1. Points System
Progressive rewards for every tracked action to build habits.

### 2. Streak Mechanics
Daily commitment reinforcement through loss aversion.

### 3. Achievement Badges
Milestone celebrations for sustained engagement.

### 4. Tier System
Status progression (Bronze → Silver → Gold → Platinum).

### 5. Variable Rewards
Unpredictable bonuses to maintain excitement.

## Point Award Structure

### Current Implementation
```yaml
Peptide_Dose_Logged: 10 points
Workout_Completed: 50 points
Nutrition_Daily_Log: 10 points
Breath_Session: 20 points
Journal_Entry: 15 points
Module_Completed: 30 points
```

### Planned Enhancements
```yaml
# Consistency Bonuses
Perfect_Week: 100 points (all 6 daily tasks for 7 days)
Monthly_Streak: 500 points (30-day streak)
Perfect_Month: 1000 points (all tasks every day for 30 days)

# Milestone Rewards
First_Peptide_Protocol: 25 points
First_Workout: 75 points
50_Doses_Logged: 200 points
100_Workouts: 500 points

# Social Engagement
Referral_Signup: 100 points
Referral_Conversion: 500 points
Testimonial_Submitted: 200 points

# Achievement Unlocks
Early_Riser: 50 points (7-day AM dose streak)
Night_Owl: 50 points (7-day PM dose streak)
Protein_King: 100 points (hit protein target 30 days)
Iron_Warrior: 100 points (50 strength workouts)
```

## Streak Mechanics

### Streak Rules
```yaml
Daily_Requirement:
  minimum: 1 of 6 trackable activities
  activities:
    - Peptide dose logged
    - Workout completed
    - Meal logged
    - Breath session
    - Journal entry
    - Module listened

Streak_Break_Conditions:
  - No activity logged by midnight (user's local timezone)
  - User explicitly resets streak

Streak_Freeze:
  - Available: 1 per month (future feature)
  - Allows: Skip one day without breaking streak
  - Use_case: Travel, illness, special circumstances
```

### Streak Display
```typescript
interface StreakDisplay {
  currentStreak: number        // Days
  longestStreak: number        // All-time record
  streakIcon: '🔥'            // Flame emoji
  color: 'orange-500'         // Visual emphasis
  message: string             // Encouraging text
}

// Examples:
// "3 days - Keep it going!"
// "10 days - You're on fire!"
// "30 days - Legendary streak!"
// "100 days - Hall of Fame!"
```

## Achievement Badge System

### Badge Categories

#### Consistency Badges
```yaml
Iron_Will:
  requirement: 30-day streak
  icon: 💪
  points: 200
  tier: Bronze

Unstoppable:
  requirement: 90-day streak
  icon: 🔥
  points: 500
  tier: Silver

Legend:
  requirement: 365-day streak
  icon: 👑
  points: 2000
  tier: Platinum
```

#### Feature Mastery Badges
```yaml
Peptide_Pioneer:
  requirement: Log 50 peptide doses
  icon: 💉
  points: 100

Workout_Warrior:
  requirement: Complete 50 workouts
  icon: 🏋️
  points: 200

Nutrition_Ninja:
  requirement: Log 100 meals
  icon: 🥗
  points: 150

Breath_Master:
  requirement: 50 breath sessions
  icon: 🌬️
  points: 100

Journal_Sage:
  requirement: 30 journal entries
  icon: 📔
  points: 150

Mind_Master:
  requirement: Complete all Mental Mastery modules
  icon: 🧠
  points: 500
```

#### Special Achievements
```yaml
Early_Adopter:
  requirement: Join within first month of launch
  icon: 🚀
  points: 100
  limited: true

Perfect_Week:
  requirement: All 6 activities every day for 7 days
  icon: ⭐
  points: 300

Influencer:
  requirement: 10 successful referrals
  icon: 📣
  points: 1000

Benefactor:
  requirement: Refer someone who subscribes
  icon: 💎
  points: 500
```

## Tier System

### Tier Thresholds
```yaml
Bronze:
  points_required: 0
  color: '#CD7F32'
  benefits:
    - Basic tracking access
    - Standard support

Silver:
  points_required: 1000
  color: '#C0C0C0'
  benefits:
    - Priority support
    - Early feature access
    - Exclusive content

Gold:
  points_required: 5000
  color: '#FFD700'
  benefits:
    - 1-on-1 coaching session
    - Custom protocol design
    - VIP community access

Platinum:
  points_required: 20000
  color: '#E5E4E2'
  benefits:
    - Lifetime discount (20%)
    - Direct access to founders
    - Beta tester for new features
    - Custom protocol + regular check-ins
```

### Tier Progression Display
```typescript
interface TierStatus {
  currentTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  currentPoints: number
  nextTier: string | null
  pointsToNextTier: number | null
  progressPercentage: number
}
```

## Variable Reward System

### Random Bonus Multipliers
```yaml
Surprise_Bonus:
  frequency: Random (5-10% of actions)
  multiplier: 2x or 3x
  display: "🎉 Lucky 2x bonus!"
  purpose: Unpredictability drives engagement
```

### Daily Spinner (Future)
```yaml
Daily_Spin:
  frequency: Once per day
  rewards:
    - 10 points (40% chance)
    - 25 points (30% chance)
    - 50 points (20% chance)
    - 100 points (8% chance)
    - 500 points (2% chance)
  visual: Spinning wheel animation
```

### Treasure Chest System (Success Deposits)
```yaml
Success_Deposit:
  user_stakes: $50 - $500
  goal: Custom (e.g., "Log all doses for 30 days")
  on_success: Full refund + bonus points
  on_failure: Forfeited to accountability partner
  psychology: Loss aversion + skin in the game
```

## Gamification Integration Points

### API Endpoints
```yaml
POST /api/gamification/points:
  body:
    pointType: string
    amount: number
    activitySource: string
    metadata: object
  response:
    success: boolean
    newTotal: number
    tierUpdate: boolean
    achievementUnlocked: string | null

GET /api/gamification/stats:
  response:
    totalPoints: number
    currentStreak: number
    longestStreak: number
    currentTier: string
    badges: Badge[]
    recentActivity: Activity[]

GET /api/gamification/leaderboard:
  query:
    period: 'weekly' | 'monthly' | 'all-time'
    metric: 'points' | 'streak' | 'workouts'
  response:
    rankings: User[]
    userRank: number
```

### Point Award Integration
```typescript
// After any trackable action
async function awardPoints(
  userId: string,
  pointType: string,
  amount: number,
  activitySource: string,
  metadata?: any
) {
  // 1. Save point transaction
  const pointRecord = await prisma.gamificationPoint.create({
    data: {
      userId,
      pointType,
      amount,
      activitySource,
      metadata,
      createdAt: new Date()
    }
  })

  // 2. Check for random bonus
  const bonusMultiplier = Math.random() < 0.07 ? 2 : 1
  const finalAmount = amount * bonusMultiplier

  // 3. Update user total
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      totalPoints: { increment: finalAmount }
    },
    include: {
      gamificationPoints: true
    }
  })

  // 4. Check tier progression
  const newTier = calculateTier(user.totalPoints)
  if (newTier !== user.currentTier) {
    await unlockTier(userId, newTier)
  }

  // 5. Check achievement unlocks
  await checkAchievements(userId, activitySource)

  // 6. Return result
  return {
    success: true,
    pointsAwarded: finalAmount,
    bonus: bonusMultiplier > 1,
    newTotal: user.totalPoints,
    tierUpdate: newTier !== user.currentTier,
    achievementUnlocked: null // populated by checkAchievements
  }
}
```

### Streak Update Integration
```typescript
// Called at midnight (user's timezone)
async function updateStreaks() {
  const users = await prisma.user.findMany({
    include: {
      peptideDoses: true,
      workoutSessions: true,
      foodLogs: true,
      breathSessions: true,
      journalEntries: true,
      moduleCompletions: true
    }
  })

  for (const user of users) {
    const yesterday = getYesterday(user.timezone)
    const hasActivity = checkActivityForDate(user, yesterday)

    if (hasActivity) {
      // Continue streak
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currentStreak: { increment: 1 },
          longestStreak: Math.max(user.currentStreak + 1, user.longestStreak)
        }
      })
    } else {
      // Break streak
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currentStreak: 0
        }
      })

      // Send "streak broken" notification
      await sendStreakBrokenNotification(user)
    }
  }
}
```

## UI/UX Guidelines

### Points Display
```jsx
<div className="flex items-center gap-2">
  <Trophy className="w-5 h-5 text-yellow-500" />
  <span className="text-white font-bold text-lg">{totalPoints} pts</span>
  <span className="text-gray-400 text-sm">({currentTier})</span>
</div>
```

### Streak Display
```jsx
<div className="flex items-center gap-2">
  <Flame className="w-5 h-5 text-orange-500" />
  <span className="text-white font-semibold">{currentStreak} day streak</span>
  {currentStreak >= 7 && <span className="text-xs text-orange-400">🔥 On fire!</span>}
</div>
```

### Achievement Unlock Animation
```jsx
{achievementUnlocked && (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
    <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg p-8 text-center animate-scale-in">
      <div className="text-6xl mb-4">{achievement.icon}</div>
      <h2 className="text-2xl font-bold text-white mb-2">Achievement Unlocked!</h2>
      <p className="text-white/90 mb-4">{achievement.name}</p>
      <p className="text-sm text-white/70">+{achievement.points} points</p>
    </div>
  </div>
)}
```

## Psychology Principles Applied

### 1. Variable Ratio Reinforcement
Random 2x/3x bonuses create "slot machine" effect - most powerful engagement driver.

### 2. Loss Aversion
Streaks make users fear losing progress, driving daily returns.

### 3. Progress Visualization
Tier progression bars show advancement, motivating continued effort.

### 4. Social Proof
Leaderboards create friendly competition and validation.

### 5. Endowed Progress Effect
Starting users at Bronze (not "No Tier") makes them feel they've already begun.

### 6. Sunk Cost Fallacy
Success Deposits leverage reluctance to waste invested money.

## Success Metrics
- Daily active user rate
- Streak continuation rate (target: >70%)
- Points earning frequency
- Achievement unlock rate
- Tier progression velocity
- Feature engagement increase

## Integration with Other Agents

- **→ All Feature Agents**: Point award after actions
- **← Observer**: Track engagement metrics
- **← Architect**: Design gamification schema
- **→ Design Enforcer**: Consistent visual feedback

## Future Enhancements
- Social challenges (group goals)
- Seasonal events (double points week)
- Custom challenges per user
- Gifting points to others
- Redemption store (swag, discounts)
