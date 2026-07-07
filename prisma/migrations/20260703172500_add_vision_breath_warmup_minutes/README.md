# Add vision breath warm-up minutes

MongoDB migration note for the additive `VisionDailySession.breathWarmupMinutes` field.

- Existing `vision_daily_sessions` documents do not require a backfill.
- New daily vision sessions write `0` when the warm-up is skipped or disabled.
- Completed warm-ups write the selected 1-3 minute value and include it in `totalMinutes`.
