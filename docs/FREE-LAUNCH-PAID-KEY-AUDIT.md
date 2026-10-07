# Free-launch paid-key audit

## Result

No free-user route can reach Jon's paid OpenAI key during the free-first launch.

## Complete application-key inventory

A repository search outside dependencies found exactly two application routes that reference `OPENAI_API_KEY`:

1. `app/api/foods/analyze-image/route.ts`
2. `app/api/voice/chat/route.ts`

Both exact paths are in `middleware.ts` `BLOCKED_PAID_AI_API_PATHS`. Middleware returns JSON `404` before Auth0 middleware or either route handler can execute. This also blocks direct requests, stale clients, and fallback calls; it does not depend on navigation being hidden.

## Visible-path audit

- The only paid-AI control reachable from a launch feature was the nutrition camera flow in `src/components/Nutrition/FoodQuickAdd.tsx`.
- The launch build removes the `CameraUpload` import, state, handler, button, modal, and `/api/foods/analyze-image` fallback from that component.
- Peptide logging uses `/api/peptides/*`; meal logging/search uses the non-AI nutrition and food-log endpoints; journal uses `/api/journal/*`; hypnosis playback uses static `/audio/mmm/*.mp3` files and completion tracking uses `/api/modules/complete`.
- The peptide Librarian and voice-chat UI are hidden from navigation and public routing. Their code remains preserved for later use.

## Verification

`check-public-readiness.cjs` performs POST requests to both paid-AI API paths and requires HTTP `404`. It also asserts that the visible meal tracker no longer imports `CameraUpload` or references `/api/foods/analyze-image`.

Re-run after every deployment:

```text
NODE_PATH=rb-public-readiness/node_modules node check-public-readiness.cjs
```

Any new application reference to `OPENAI_API_KEY` is a launch blocker until it is either removed from the free-user graph or added to the middleware denial set and verified on the deployed site.
