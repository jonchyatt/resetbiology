# Add binocular vision training metrics

Mongo deployment note for Prisma schema changes in this PR.

This change adds optional fields only:

- `VisionSession.deviceMode`
- `VisionSession.trainingFocus`
- `VisionSession.binocularMode`
- `VisionSession.sessionSource`
- `VisionSession.binocularOutcome`
- `VisionSession.binocularFusionHeldSeconds`
- `VisionSession.binocularAttempts`
- `VisionSession.binocularCorrect`
- `VisionDailySession.binocularResults`

No existing records require backfill. Deploy with the normal Prisma Mongo flow
for this project, then run `prisma generate`.
