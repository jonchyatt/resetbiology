# add_pitch_defender_game_scores

This repository uses Prisma with MongoDB, so Prisma Migrate does not emit SQL migration files.

Deploy step:

```powershell
npx prisma db push
npx prisma generate
```

Schema change:

- Adds `GameScore`, mapped to the `game_scores` collection.
- Adds `User.gameScores`.
- Adds a unique user/game key on `[userId, gameKey]`.
