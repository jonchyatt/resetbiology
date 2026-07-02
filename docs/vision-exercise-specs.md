# Vision Exercise Specs

Source corpus: `screenfit/`

Extraction pass:

- `Vision Foundations Workbook - Interactive.pdf`: 29 pages, 19,441 extracted characters. This is the primary extractable source for weekly structure, assessments, setup, and the 30-workout sequence.
- `Week One` through `Week Six Interactive Checklist.pdf`: extractable and used to confirm workout order, pairing, reminders, progress checks, and weekly takeaways.
- `Set-up Interactive Checklist.pdf`: extractable and used for setup requirements.
- Individual `Exercise-*` sheets: title text extracted for most files, but detailed body content was not extractable through `pdfplumber`; these appear to be image-first sheets. Their extraction limitation is logged here rather than guessed as quoted source.
- `Lesson-*` sheets: most returned zero or near-zero body text, except title/letter-chart fragments. Logged as extraction-limited.
- `Improve eyesight at various distances.md`: used as the existing product brief for progressive distance, Snellen, device-distance, and session tracking requirements.

Program structure extracted from the workbook/checklists:

- Six-week course.
- Five workouts per week.
- Each day repeats the previous exercise and adds the new exercise.
- Baselines and review checkpoints appear at setup, halfway, and post-program.
- Checklists emphasize daily notes, challenges, breakthroughs, eye-jump results, and moving-object timing.

Device rules for all engines:

- Phone distance: arm length, roughly 20-60 cm.
- Desktop distance: desk distance, roughly 60-100 cm.
- No engine should instruct users to stand meters away from controls.
- Visual stimuli are functional training targets, not decoration.
- Static instruction cards with a timer and a completion button are not acceptable engines.

## 1. Pushups For Your Focusing System

Source: `Exercise-01-Pushups-for-Focusing.pdf`, Week One checklist, workbook.

Purpose: Build accommodation and convergence control by repeatedly moving a near target through the edge of clarity.

Protocol: Present a high-contrast near target. User starts at a comfortable distance, brings the target closer in small steps, pauses at first blur, breathes, and regains clarity before continuing.

Timing/reps: Week One workouts 1-2. App default: 2-3 rounds of 60-90 seconds.

Progression: Small distance changes, roughly 0.5-2 cm. Advance only when clarity returns without strain.

Physical eye action: Both eyes converge and accommodate while head and shoulders stay quiet.

Engine must render/measure: Render a sharp target at calibrated size, prompt closer/farther micro-adjustments, track distance band, blur-recovery self-report, completed rounds, and session duration.

## 2. Eye Stretches

Source: `Exercise-02-Eye-Stretches.pdf`, Week One checklist.

Purpose: Restore comfortable ocular range before harder focus and pursuit drills.

Protocol: Guide slow gaze holds to left, right, up, down, and diagonals while the head remains still.

Timing/reps: Week One workouts 2-3. App default: 8 directions, 5-8 seconds each, 2 rounds.

Progression: Increase hold time and add diagonal directions only if movement stays pain-free.

Physical eye action: Extraocular muscles move the eyes to range without neck substitution.

Engine must render/measure: Render directional targets at screen edges, measure hold completion, missed holds, head-stillness self-checks, and discomfort flag.

## 3. Smooth Tracking

Source: `Exercise-03-Smooth-Tracking.pdf`, Week One checklist.

Purpose: Train smooth pursuit so the eyes glide instead of jumping.

Protocol: User follows a moving target with eyes only through horizontal, vertical, circular, and figure-8 paths.

Timing/reps: Week One workouts 3-4. App default: 3 minutes across four path phases.

Progression: Start slower and larger. Increase speed and path complexity only when the target stays clear and head remains still.

Physical eye action: Smooth pursuit with quiet cervical spine and relaxed jaw.

Engine must render/measure: Render an animated pursuit target, current path, speed phase, phase timing, loops completed, pauses, reduced-motion fallback, and subjective smoothness checks.

## 4. Palming

Source: `Exercise-04-Palming.pdf`, Week One checklist.

Purpose: Downshift visual tension and nervous-system load.

Protocol: User warms palms, cups them over closed eyes without pressure, breathes slowly, and notices the visual field darkening.

Timing/reps: Week One workouts 4-5. App default: 3-4 minutes.

Progression: Increase breath steadiness and reduce facial tension before harder drills.

Physical eye action: Eyes closed, orbital area relaxed, no pressure on the eyeballs.

Engine must render/measure: Render a breathing orb or dark-field cue, time inhale/exhale phases, record tension checks, and capture whether the user felt visual relaxation.

## 5. Focus Trombone

Source: `Lesson -5 - Focus Trombone (2).pdf`, Week One/Two checklists.

Purpose: Train dynamic near/far accommodation toggling.

Protocol: User alternates focus between a near and farther target in rhythm with breath.

Timing/reps: Week One workout 5 and Week Two workout 6. App default: 2-4 minutes.

Progression: Increase distance spread gradually. Add smaller text only after clarity is reliable.

Physical eye action: Accommodation and vergence shift between depth planes.

Engine must render/measure: Render near/far targets or screen-size equivalents, guide toggles, record clear/blur responses, target distance, and successful switches.

## 6. Eye Jumps

Source: `Exercise-06-Eye-Jumps.pdf`, `Lesson -6 - Eye Jumps (1).pdf`, Week Two checklist.

Purpose: Train accurate saccades and reading/sport quickness.

Protocol: User jumps gaze between two or more targets on cue, identifying the active target without head movement.

Timing/reps: Week Two workouts 6-7. App default: 60 seconds per target layout.

Progression: Increase tempo after accuracy is high; add diagonals and more targets.

Physical eye action: Fast saccades with fixation landing on the target.

Engine must render/measure: Render target pairs/quadrants, cue cadence, hit/miss responses, reaction time, accuracy, and max controlled tempo.

## 7. Expanding Your Side Vision

Source: `Exercise-07-Expanding-Side-Vision.pdf`, `Lesson -7 - Expanding your Side Vision (1).pdf`, Week Two checklist.

Purpose: Reduce tunnel vision by improving peripheral awareness.

Protocol: User fixes gaze centrally while detecting peripheral flashes, colors, or shapes.

Timing/reps: Week Two workouts 7-8. App default: 2-3 rounds of 60 seconds.

Progression: Move targets farther outward, reduce contrast, or increase stimulus count.

Physical eye action: Central fixation with peripheral attention expansion.

Engine must render/measure: Render center fixation plus peripheral stimuli, measure detection accuracy by quadrant, fixation breaks, and field-width level.

## 8. Two-Eyed Coordination

Source: `Exercise-08-Two-Eyed-Coordination.pdf`, Week Two checklist.

Purpose: Improve binocular teaming and depth coordination.

Protocol: User performs paired-eye tasks that require both eyes to maintain a shared target.

Timing/reps: Week Two workouts 8-9. App default: 2-3 minutes.

Progression: Increase target separation or add binocular modes after stable fusion.

Physical eye action: Both eyes converge/diverge together without suppression or strain.

Engine must render/measure: Render paired targets, optional red/green or duplicate layouts, record fusion self-report, break events, and successful holds.

## 9. Peripheral Pointing

Source: `Exercise-09-Peripheral-Pointing.pdf`, `Lesson -9 - Peripheral Pointing (1).pdf`, Week Two checklist.

Purpose: Connect peripheral vision to body mapping and pointing accuracy.

Protocol: User keeps central gaze fixed, detects a peripheral target, and points toward it without looking directly.

Timing/reps: Week Two workouts 9-10. App default: 20-30 targets.

Progression: Add category rules, smaller targets, and wider positions.

Physical eye action: Fixation stays central while arm reaches to peripheral location.

Engine must render/measure: Render peripheral targets, capture tap/point direction, quadrant accuracy, reaction time, and fixation-quality self-check.

## 10. Taking In Space

Source: `Exercise-10-Taking-in-Space.pdf`, Week Two/Three checklists.

Purpose: Build whole-field spatial awareness in daily movement.

Protocol: User softens gaze and notices the room edges or walking environment while keeping attention broad.

Timing/reps: Week Two workout 10 and Week Three workout 11. App default: 2 minutes.

Progression: Add walking or object-count tasks once seated awareness is easy.

Physical eye action: Soft central fixation with broad peripheral attention.

Engine must render/measure: Render expanding field cues, prompt object counts by zone, record peripheral count, confidence, and balance/tension checks.

## 11. Mirror Eye Movement

Source: `Exercise-11-Mirror-Eye-Movement.pdf`, Week Three checklist.

Purpose: Train eye movement while a mirror or app feedback keeps head movement honest.

Protocol: User tracks prescribed paths while monitoring that head and shoulders stay centered.

Timing/reps: Week Three workouts 11-12. App default: 3 minutes.

Progression: Add diagonal paths and smaller targets.

Physical eye action: Eyes scan while head remains fixed.

Engine must render/measure: Render path targets, mirror/head-stillness prompts, path completion, direction changes, and self-reported head drift.

## 12. Alphabet Visualization

Source: `Exercise-12-Alphabet-Visualization.pdf`, Week Three checklist.

Purpose: Strengthen visual memory and eye-brain imagery.

Protocol: User visualizes letters or traces an alphabet path with eyes closed or soft gaze.

Timing/reps: Week Three workouts 12-13. App default: one alphabet pass or 2 minutes.

Progression: Move from large letters to smaller letters, reverse order, or randomized letters.

Physical eye action: Internal visual tracking and memory recall.

Engine must render/measure: Render letter prompts, ask for imagined direction/path, record completion, recall accuracy, and mental clarity score.

## 13. Eye Squeezes

Source: `Exercise-13-Eye-Squeezes.pdf`, Week Three checklist.

Purpose: Reset blink quality and release ocular tension.

Protocol: User gently closes/squeezes eyes, releases fully, and blinks naturally.

Timing/reps: Week Three workouts 13-14. Checklist notes this can be done daily with water breaks.

Progression: Improve relaxation after each release; do not increase force.

Physical eye action: Controlled eyelid closure and release, not eyeball pressure.

Engine must render/measure: Render squeeze/release rhythm, count reps, record dryness/tension before and after, and discomfort flag.

## 14. Pendrops

Source: `Exercise-14-Pendrops.pdf`, Week Three checklist.

Purpose: Train vertical tracking, anticipation, and fixation recovery.

Protocol: User follows or catches falling visual targets while maintaining posture.

Timing/reps: Week Three workouts 14-15. App default: 20-40 drops.

Progression: Increase drop speed, reduce target size, or add distractors.

Physical eye action: Vertical pursuit with fixation landing.

Engine must render/measure: Render falling targets, capture tap/response accuracy, reaction time, misses, and level speed.

## 15. Laterality

Source: `Exercise-15-Laterality.pdf`, `Lesson -15 laterallity.pdf`, Week Three/Four checklists.

Purpose: Improve left/right mapping and cross-body coordination.

Protocol: User responds to left/right visual prompts with matching or opposite hand/body actions.

Timing/reps: Week Three workout 15 and Week Four workout 16. App default: 30-60 prompts.

Progression: Add crossed responses, faster cadence, and mixed up/down prompts.

Physical eye action: Visual target recognition plus body-side mapping.

Engine must render/measure: Render left/right prompts, capture response side, reaction time, accuracy, and crossed-midline errors.

## 16. Smooth Pursuits

Source: `Exercise-16-Smooth-Pursuits.pdf`, Week Four checklist.

Purpose: Advance Smooth Tracking into longer or more complex pursuit control.

Protocol: User follows moving stimuli through longer, multi-axis pursuit paths.

Timing/reps: Week Four workouts 16-17. App default: 3-5 minutes.

Progression: Increase path speed, add corners/curves, and reduce target size.

Physical eye action: Continuous pursuit without saccadic jumping.

Engine must render/measure: Render multi-path motion, speed phase, loop count, pauses, subjective jerkiness, and head-stillness checks.

## 17. Close Eye Movements

Source: `Exercise-17-Close-Eye-Movements.pdf`, Week Four checklist.

Purpose: Train controlled ocular movement at close range.

Protocol: User tracks near targets or performs small controlled gaze shifts at arm length.

Timing/reps: Week Four workouts 17-18. App default: 2-3 minutes.

Progression: Shrink target path and add closer ranges only if comfortable.

Physical eye action: Small range movements with accommodation loaded.

Engine must render/measure: Render close-range targets, distance guidance, blur reports, path completion, and discomfort flag.

## 18. Eye Rolls

Source: `Exercise-18 Eye Rolls.pdf`, Week Four checklist.

Purpose: Maintain comfortable circular range and reduce stiffness.

Protocol: User rolls gaze slowly clockwise and counterclockwise without neck motion.

Timing/reps: Week Four workouts 18-19. App default: 3 rounds each direction.

Progression: Increase smoothness, not speed.

Physical eye action: Circular extraocular movement.

Engine must render/measure: Render circular path, count completed circles, direction changes, smoothness self-check, and strain flag.

## 19. Strengthening Your Focus

Source: `Exercise -19 Strengthening Your Focus.pdf`, Week Four checklist.

Purpose: Reinforce accommodation endurance after earlier focus drills.

Protocol: User sustains clarity on a target near the edge of blur, then recovers.

Timing/reps: Week Four workouts 19-20. App default: 3 holds of 30-45 seconds.

Progression: Increase hold time or decrease target size after stable clarity.

Physical eye action: Sustained accommodation without facial/neck tension.

Engine must render/measure: Render high-contrast target, hold timer, clarity check-ins, blur recovery time, and max hold.

## 20. Eye Massages

Source: `Exercise-20 Eye Massages.pdf`, Week Four/Five checklists.

Purpose: Provide a toolkit exercise for tension management and recovery.

Protocol: User performs gentle surrounding-area massage without direct pressure on the eyeball.

Timing/reps: Week Four workout 20 and Week Five workout 21. App default: 2 minutes.

Progression: Improve relaxation quality; never increase pressure.

Physical eye action: Eyes relaxed or closed while surrounding tissue relaxes.

Engine must render/measure: Render safe-zone map, guide sequence, record completion, pressure caution confirmations, and before/after tension score.

## 21. Focused Eye Tracking

Source: `Exercise -21 Focused Eye Tracking.pdf`, `Lesson -21 - Focused Eye Tracking (1).pdf`, Week Five checklist.

Purpose: Combine focus stability with tracking movement.

Protocol: User keeps the moving target sharp while tracking a prescribed route.

Timing/reps: Week Five workouts 21-22. App default: 3 minutes.

Progression: Add speed only after the target stays clear through the full path.

Physical eye action: Pursuit plus accommodation stability.

Engine must render/measure: Render moving target with sharpness challenge, path phase, blur taps, loops completed, and recovery time.

## 22. Large Eye Jumps

Source: `Exercise -22 Large Eye Jumps.pdf`, `Lesson -22 - Large Eye Jumps (3).pdf`, Week Five checklist.

Purpose: Expand saccadic range with larger jumps.

Protocol: User jumps gaze between widely spaced targets and identifies each one.

Timing/reps: Week Five workouts 22-23. App default: 30-50 jumps.

Progression: Increase separation, tempo, and number of target positions.

Physical eye action: Large saccades with accurate fixation landing.

Engine must render/measure: Render large separated targets, capture correct identification, reaction time, misses, and max separation.

## 23. Training Your Side Vision

Source: `Exercise -23 Training Your Side Vision.pdf`, `Lesson -23 - Training Your Side Vision (1).pdf`, Week Five checklist.

Purpose: Advance side-vision detection and attention.

Protocol: User maintains center fixation and detects side targets under changing contrast or position.

Timing/reps: Week Five workouts 23-24. App default: 2-3 rounds of 60 seconds.

Progression: Lower contrast, increase eccentricity, or add simultaneous targets.

Physical eye action: Fixation plus lateral peripheral awareness.

Engine must render/measure: Render side targets, measure left/right detection accuracy, response time, and fixation-break self-check.

## 24. Mirror Eye Movement Part Two

Source: `Exercise -24 Mirror Eye Movement, Part 2.pdf`, Week Five checklist.

Purpose: Upgrade mirror eye movement with more complex paths.

Protocol: User performs mirror-assisted eye movements with added diagonals, reversals, or dual tasks.

Timing/reps: Week Five workouts 24-25. App default: 3-4 minutes.

Progression: Add path complexity and require cleaner head stillness.

Physical eye action: Eyes sweep through prescribed paths while posture stays stable.

Engine must render/measure: Render advanced paths, count reversals, ask head-drift checks, and record completed path sets.

## 25. Visual Scan

Source: `Exercise -25 Visual Scan.pdf`, `Lesson -25 - Visual Scan (3).pdf`, Week Five/Six checklists.

Purpose: Improve systematic scanning for reading, desk work, and space navigation.

Protocol: User scans rows, columns, or a visual field in a specific order and identifies targets.

Timing/reps: Week Five workout 25 and Week Six workout 26. App default: 2-4 scan grids.

Progression: Increase grid size, reduce contrast, add distractors, and time the scan.

Physical eye action: Ordered saccades and fixation along a scan pattern.

Engine must render/measure: Render scan grid, capture targets found, omissions, scan time, and revisit count.

## 26. Figure 8 Fixation

Source: `Exercise -26 Figure 8 Fixation (1).pdf`, Week Six checklist.

Purpose: Integrate fixation and pursuit on an infinity path.

Protocol: User follows or fixates along a figure-8 path while breathing steadily.

Timing/reps: Week Six workouts 26-27. App default: 2 directions, 60-90 seconds each.

Progression: Change size, speed, direction, or add near/far layers.

Physical eye action: Smooth pursuit around crossing loops with central reorientation.

Engine must render/measure: Render infinity path, direction, speed, completed loops, midline drift self-check, and blur events.

## 27. Pyramid Pointing

Source: `Exercise -27 Pyramid Pointing (1).pdf`, `Lesson -27 - Pyramid Pointing (2).pdf`, Week Six checklist.

Purpose: Combine pointing, spatial mapping, and progressively organized visual targets.

Protocol: User points or taps targets arranged in a pyramid sequence while preserving gaze control.

Timing/reps: Week Six workouts 27-28. App default: 3 pyramid passes.

Progression: Increase pyramid size, randomize order, or add left/right hand rules.

Physical eye action: Visual search, saccades, and hand-eye coordination.

Engine must render/measure: Render pyramid targets, capture tap order, timing, accuracy, and hand-side prompts.

## 28. Developing Your Internal GPS

Source: `Exercise -28 Developing Your Internal GPS.pdf`, Week Six checklist.

Purpose: Strengthen spatial orientation and internal mapping.

Protocol: User tracks positions, directions, or routes and recalls where targets appeared.

Timing/reps: Week Six workouts 28-29. App default: 2-3 memory routes.

Progression: Add more waypoints, delay recall, or rotate the map.

Physical eye action: Visual mapping plus memory and direction recall.

Engine must render/measure: Render waypoints, hide/reveal map, record recall accuracy, route completion, and confidence.

## 29. Focusing Flexibility

Source: `Exercise -29 Focusing Flexibility.pdf`, Week Six checklist.

Purpose: Improve flexible switching across focus distances.

Protocol: User alternates between targets at different sizes or depths and reports clarity.

Timing/reps: Week Six workouts 29-30. App default: 3 rounds of near/mid/far equivalents.

Progression: Add smaller text, faster switching, or wider distance range.

Physical eye action: Accommodation changes quickly without strain.

Engine must render/measure: Render multiple target depths, guide switching, measure clear responses, switch accuracy, and blur recovery time.

## 30. Following A Moving Object

Source: `Exercise -30 Following a Moving Object.pdf`, `Lesson -30 - Following a Moving Object (1).pdf`, Week Six checklist.

Purpose: Integrate pursuit with real-world moving targets and endurance.

Protocol: User follows a moving object, then records timing or reading comparison as noted in the Week Six checklist.

Timing/reps: Week Six workout 30. App default: 3 moving-object rounds plus result capture.

Progression: Increase movement speed, add unpredictable direction changes, and compare paragraph timing.

Physical eye action: Smooth pursuit, fixation recovery, and sustained attention.

Engine must render/measure: Render moving object paths, capture pursuit rounds, misses, speed level, and paragraph timing fields.
