# Persistent Browser Testing

## Setup (One Time)
1. Save auth state: `npm run test:auth-save`
2. Auth is saved to `auth-state.json` ✅

## Usage

### Start Persistent Browser Session
```bash
npx playwright test tests/persistent-timing-test.spec.ts --headed
```

Browser will:
- Open and stay open
- Use your saved auth (already logged in)
- Run the timing test
- Stay open at the end for you to inspect

### Run Commands in Open Browser
While browser is open, sub-agents can:
- Navigate pages
- Click buttons
- Check console logs
- All while you watch!

### If Browser Closes
Just run the test again - it will use auth-state.json to log back in automatically.

## Manual Inspection
While browser is open:
1. Open DevTools (F12)
2. Go to Console tab
3. Watch for `timing=` logs
4. See protocol save/load events in real-time

## Commands
- `npm run test:persistent` - Run full timing test
- `npm run browser:peptides` - Navigate to peptides
- `npm run browser:edit` - Click edit button
- `npm run browser:reload` - Reload page
