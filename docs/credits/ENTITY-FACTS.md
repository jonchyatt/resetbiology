# Entity facts and reusable answer blocks for startup-credit programs

Drafted 2026-10-17. **Draft only.** Nothing here has been submitted. Submitting an application is red 2 (signs or binds); entering account credentials is red 5; anything that spends money is red 1. Those steps stay with Jonathan.

Every line is tagged:
- **VERIFIED**: read in this repo (file cited).
- **UNVERIFIED**: stated by a person or a code comment, not confirmed by a document.
- **GAP**: not in the repo. Do not guess; a program form must not be filled until it is supplied.

## 1. The entity

| Field | Value | Status |
|---|---|---|
| Legal name | Satori Enterprises, Inc. | UNVERIFIED. Named in the project backlog; `app/privacy/page.tsx:84` and `app/terms/page.tsx:82` say "no RB legal entity documented; Satori Enterprises d/b/a link unverified (entity-specialist 2026-07-15)". |
| Relationship to Reset Biology | Reset Biology is a d/b/a or product of Satori Enterprises, Inc. | **GAP / open ownership question.** The only repo text says the link is unverified. |
| Entity form for tax (S-corp, etc.) | Not stated | **GAP.** The funder-page TODO asks Jonathan to confirm S-corp status. |
| State of incorporation, EIN, formation date, registered address | Not stated | **GAP.** Never in the repo; do not invent. |
| Site | resetbiology.com | VERIFIED (`CLAUDE.md`). |
| Funder named on the site | Satori Living Foundation ("Free access is funded by the Satori Living Foundation") | VERIFIED: `app/about/page.tsx:28`, `app/page.tsx:60`, `src/components/Navigation/Footer.tsx:31`. Whether the Foundation is related to Satori Enterprises, Inc. is a **GAP**. |
| Clinical operator of the peptide co-op | Adam Hyatt, FNP, Zion Direct Care, under his own license | VERIFIED: `app/about/page.tsx`. Reset Biology says it takes no payment on the site and gives no medical advice. |

## 2. What the product is (verified from the repo)

- Free member web app: sign-up, peptide tracker, meal tracker, daily journal, hypnosis modules, breath training, vision exercises, ear training, workout tracking (`app/about/page.tsx`, `CLAUDE.md`).
- Education pages and links out to a member-owned peptide co-op. No on-site checkout (PR #39 moved the store to outbound seller links).
- Member data can be exported and deleted by the member; optional sync to the member's own Google Drive (`src/lib/member-data.ts`, `docs/PHASE-2-DRIVE-PRIMARY.md`).

## 3. Technical footprint (what credits would offset)

Read from `package.json` and source on master; usage volumes are **GAP** (no analytics export in the repo).

| Area | In use | Credit programs that could apply |
|---|---|---|
| Hosting | Vercel (production project `app`; GitHub-integrated deploy); Cloudflare Pages as backup build | Vercel and Cloudflare startup programs |
| Database | MongoDB Atlas via Prisma 6 (free-tier 512 MB; two quota outages, see `CLAUDE.md`) | MongoDB for Startups |
| Auth | Auth0 v4 (Google OAuth) | Auth0 startup program |
| Email | Resend | Resend startup credits (if offered) |
| AI | OpenAI SDK: `gpt-4o-mini` for agents, `whisper-1` for speech-to-text, `tts-1` for text-to-speech (`src/lib/agents/*`, `app/api/voice/chat/route.ts`) | OpenAI and other model-provider startup credits |
| File storage | Vercel Blob | Covered by Vercel |
| Payments | Stripe SDK present; the public site takes no payment | Stripe is not a credit target |
| On-device ML | TensorFlow.js, ONNX Runtime Web, HF Transformers (runs in the browser; no server cost) | None needed |

## 4. Reusable answer blocks

Use only the VERIFIED facts. Fields marked `[GAP: ...]` must be filled by Jonathan before any submission.

**One-line description**
Reset Biology is a free web app that gives members tracking and education tools for peptides, nutrition, journaling, breathing and vision training, with ordering handled by a member-owned co-op run by a licensed clinician.

**What problem do you solve?**
Members who follow clinician-supervised peptide protocols have no simple place to log doses, meals and daily notes, or to learn the basics. Reset Biology provides those tools free of charge, keeps the member in control of their own data (export, delete, optional sync to their own Google Drive), and gives no medical advice.

**How are you funded?**
Free access is funded by the Satori Living Foundation. [GAP: dollar amount, term, and the Foundation's relationship to the applicant entity.]

**Business model / revenue**
The site takes no payment. [GAP: revenue, if any, and its source; do not describe the co-op as the applicant's revenue until the ownership question is answered.]

**Stage and traction**
Live at resetbiology.com. [GAP: registered members, monthly active members. Not in the repo; pull from the production database or analytics at the local seat, never from a cloud thread.]

**Team**
[GAP: founder names and titles for the form; not stated in the repo.] Clinical operator for the co-op: Adam Hyatt, FNP (Zion Direct Care), under his own license.

**How would credits be used?**
Hosting and database headroom (Vercel, MongoDB Atlas, the Atlas free tier has already filled twice), and speech and language model calls for the voice coach (`gpt-4o-mini`, `whisper-1`, `tts-1`). [GAP: monthly spend today; no billing data in the repo.]

**Data and privacy summary**
Members authenticate with Auth0 and can export or delete their data. Optional vault sync writes only to the member's own Google Drive using the `drive.file` scope. No health claims are made on the site.

## 5. Open questions only Jonathan can close

1. Is Reset Biology a d/b/a of Satori Enterprises, Inc., or a separate entity? (Blocks nearly every form.)
2. State of incorporation, EIN and formation date for the form.
3. Is the Satori Living Foundation related to Satori Enterprises, Inc.?
4. Current member counts and monthly infrastructure spend.
5. Who owns the existing equipment (also open on the funder page).

## 6. Red steps (not done, not started)

- Submitting any application: red 2.
- Logging in to a program portal or entering card details: red 5 (and red 1 if it spends).
- Publishing an entity line on `/privacy` or `/terms`: red 3; that is the separate "entity truth" thread.
