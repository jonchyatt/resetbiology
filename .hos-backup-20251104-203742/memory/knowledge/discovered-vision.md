# ResetBiology.com - Discovered Vision

## Mission Statement

**From MissionSection.tsx:**
"We built Reset Biology to fix what's broken: people trying to make change but trapped on health damaging meds, by providers who really should know better. Our founders are medical providers; income comes from hospital work—not from churning you."

**Core Philosophy:**
- Fix broken healthcare: stop providers from trapping patients on harmful medications
- Provide expert-guided support without sales pressure
- Partner with successful clients who join the team
- Deliver lean, efficient care that passes savings to clients
- Build trust through high-touch, human-centered experience

## Target Audience

**Primary:**
- Individuals struggling with weight and metabolic health
- People frustrated with traditional healthcare's medication-first approach
- Those seeking peptide therapy alternatives to GLP-1s (semaglutide/tirzepatide)
- Health-conscious individuals wanting cutting-edge wellness optimization

**Characteristics:**
- Willing to commit to protocols and self-tracking
- Tech-savvy enough to use web portal and tracking tools
- Interested in research-backed interventions
- Value transparency and partnership over traditional patient-provider dynamics
- Remote-capable but want personalized support

**Anti-pattern (who they're NOT for):**
From MuscleWarning component: "If you're looking for muscle, hire a bodybuilder. We built this to escape health damage—not make you look like He-Man."

## Core Value Propositions

**1. Legal, IRB-Approved Retatrutide Access**
- Triple-receptor peptide that "makes semaglutide and tirzepatide obsolete"
- Legal, monitored, exponentially more effective
- True metabolic restoration vs. symptom suppression
- Focus on cellular health, not just weight loss

**2. Mental Mastery Integration**
- Addresses emotional aspects that created weight problems
- Guided coaching transforms pharmaceutical effects into permanent behavioral change
- Integrated breath training, mental mastery modules
- Psychology meets peptide science

**3. Metabolic Partnership Until Independence**
- "We don't rent you results"
- Home monitoring and data dashboards
- Structured tapering protocols
- Psychological support throughout
- Goal: achieve true metabolic freedom, not dependency

**4. Comprehensive Tracking System**
- Peptide protocols and dosing
- Nutrition logging
- Workout tracking
- Breath training
- Daily journaling with behavioral psychology
- Gamification with points and streaks

**5. Expert-Guided, Remote-Capable Care**
- Medical providers with hospital income (aligned incentives)
- Former participants who succeeded now on team
- Scalable, affordable without sacrificing humanity
- Trust-building through transparency

## Brand Voice

**Tone:** Direct, authentic, slightly contrarian
- Challenges traditional healthcare ("Should we keep ignoring...")
- Questions conventional approaches
- Honest about limitations
- Partnership-focused, not authoritative
- Urgency without pressure
- Scientific but accessible

**Language Patterns:**
- Rhetorical questions ("Is it unreasonable to expect real help instead of another sales pitch?")
- Direct challenges to status quo
- Emphasizes what's NOT the approach as much as what is
- Uses "we" inclusively (provider + patient partnership)
- Transparent about business model

**Visual Identity:**
- Primary: Teal (#3FBFB5) - trust, health, technology
- Secondary: Green (#72C247) - vitality, growth
- Dark themes with transparency effects
- Gradient overlays on hero backgrounds
- Professional yet warm

## Key Features

### Public Marketing Site:
- Hero with quiz CTA + testimonials
- Problem/solution framing
- Mission story (providers' perspective)
- Comparison to traditional approaches
- Portal preview/teaser
- FAQ section
- Referral/affiliate program mention

### Client Portal (`/portal`):
- **Peptide Tracking:** Protocol management, dose logging, calendar view, adherence tracking
- **Nutrition Logging:** Food diary, macro tracking, meal logging with common foods database
- **Workout Tracking:** Exercise logging, session tracking, progress monitoring (30+ exercises)
- **Breath Training:** Guided sessions, hold timers, progress tracking
- **Mental Mastery Modules:** Audio programs, completion tracking
- **Daily Journal:** Weight tracking, mood, affirmations (David Snyder format), auto-populated activity notes
- **Gamification:** Points system, daily tasks, streak tracking, achievement tiers
- **E-commerce Integration:** Order peptides directly from portal

### Technical Infrastructure:
- Auth0 authentication with Google OAuth
- MongoDB Atlas database (production)
- Next.js 15 with React 19
- Stripe payment processing
- PWA with push notifications (for dose reminders)
- Real-time tracking with timezone-safe date handling

## User Journey

**1. Discovery (Public Site)**
- Land on hero → see direct challenge to traditional healthcare
- Take quiz/assessment (leads to IRB handoff for retatrutide)
- Learn about mission and difference
- View testimonials
- Compare to alternatives

**2. Assessment & Onboarding**
- Complete health assessment
- IRB approval process (for research peptides)
- Create account (Auth0 + auto-provisioning)
- Initial setup and goal setting

**3. Portal Access & Daily Use**
- Login → Daily Check-in dashboard
- Complete daily tasks (peptides, workout, nutrition, breath, modules, journal)
- Track adherence and earn points
- Build streaks for consistency
- Monitor progress via data

**4. Tracking & Protocols**
- Set up peptide protocols (dosage, timing, frequency)
- Log doses with reminders
- Track workouts and nutrition
- Complete mental mastery modules
- Daily journaling with affirmations

**5. Commerce & Ongoing Support**
- Order peptides from integrated store
- Monitor inventory and reorder
- (Future) Upgrade from trial to paid
- (Future) Affiliate referrals

**6. Independence (Long-term Goal)**
- Achieve metabolic restoration
- Taper off peptides with guidance
- Maintain behavioral changes
- Transition to sustainable independence

## Discovery Notes

### Analyzed Files:
- `app/page.tsx` - Homepage component structure
- `src/components/Hero/HeroSection.tsx` - Main landing
- `src/components/Hero/MissionSection.tsx` - Origin story
- `src/components/Hero/SolutionSection.tsx` - Value props
- `src/components/Hero/ProblemSolution.tsx` - Problem framing
- `src/components/Hero/ComparisonSection.tsx` - Differentiation
- `src/components/Hero/PortalTeaser.tsx` - Portal preview
- `src/components/Hero/MuscleWarning.tsx` - Anti-pattern messaging
- `src/components/Hero/QuizCTA.tsx` - Primary CTA
- `src/components/Portal/EnhancedDashboard.tsx` - Main portal interface
- `prisma/schema.prisma` - Data model
- `package.json` - Tech stack
- `CLAUDE.md` - Development context

### Key Insights:

**1. Medical Provider Background:**
The founders being medical providers with hospital income is a core differentiator—aligns incentives away from "churning patients" toward genuine outcomes.

**2. Former Clients as Team Members:**
"We have also partnered with some of our first clients to literally join our team. We know what you are going through."
This creates peer support and credibility.

**3. Research Protocol (IRB):**
Retatrutide access through IRB-approved research protocol provides legal pathway to cutting-edge peptides while maintaining scientific rigor.

**4. Behavioral Psychology Integration:**
Not just peptides—combines with:
- Daily affirmations (David Snyder format)
- Mental mastery audio modules
- Breath training (Wim Hof style)
- Gamification for habit formation
- Detailed journaling

**5. Comprehensive Tracking:**
The portal is essentially a "quantified self" platform for cellular health optimization—everything logged, tracked, gamified.

**6. PWA + Notifications:**
Push notification system for dose reminders shows commitment to adherence and user success.

**7. Remote-First Design:**
Built for scalability and remote delivery while maintaining "high-touch" feel through data dashboards and monitoring.

### Notable Patterns:

- **Contrarian Positioning:** Actively challenges traditional healthcare and even other peptide providers
- **Transparency:** Business model (hospital income vs. patient revenue) disclosed upfront
- **Partnership Language:** Consistent use of "we partner with you" vs. traditional provider-patient hierarchy
- **Goal of Independence:** Explicitly NOT trying to create dependency
- **Practical, Not Aspirational:** Focus on health outcomes, not aesthetic goals
- **Data-Driven:** Everything measured, tracked, visualized

### Target Outcome:
"True metabolic freedom" through combination of:
1. Advanced peptide therapy (Retatrutide)
2. Behavioral psychology (modules, journaling, affirmations)
3. Habit formation (gamification, tracking)
4. Physiological practices (breath training, exercise, nutrition)
5. Tapering support (structured exit strategy)

This is wellness-as-a-service with an explicit end goal of independence rather than subscription dependency.
