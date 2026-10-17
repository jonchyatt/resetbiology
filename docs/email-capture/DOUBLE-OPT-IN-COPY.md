# Email capture: double opt-in copy (draft)

Status: draft for Jonathan's read. Nothing here is live. The card ships off behind `NEXT_PUBLIC_RB_EMAIL_CAPTURE`. The sender (Resend, `NEWSLETTER_FROM`) is untouched.

## What already exists (read from the repo)

- `POST /api/newsletter` stores a `pending` row and sends one confirmation mail (token link, 30 day expiry). A row becomes `confirmed` only through `/api/newsletter/confirm`.
- Every mail carries an unsubscribe link (`/api/newsletter/unsubscribe`).
- The card shows only to visitors who are not already subscribed (`/api/newsletter/status`).

## Card copy (current, unchanged)

> Free weekly notes on running your own biology. No selling, ever.

Under the button after submit: "Check your inbox to confirm."

## Proposed changes (not applied)

1. Under the button, one line before submit: "One email to confirm, then weekly notes. Unsubscribe any time."
2. Confirmation mail subject (now "Confirm your Reset Biology notes"): keep.
3. Confirmation mail body, now a bare link. Proposed:

   > You asked for Reset Biology notes at resetbiology.com. Confirm with one click: {confirmLink}
   >
   > If that was not you, ignore this. Nothing is sent until you confirm, and the request expires in 30 days.
   >
   > Unsubscribe: {unsubscribeLink}

4. Confirmed page text: "You are on the list. The first note arrives with the next weekly send."

## Open items for Jonathan

- "Weekly" and "No selling, ever" are existing site promises; confirm both still hold before the flag flips (publishing under the business name, red 3).
- A postal address line in the footer is usual for commercial mail; none is in the repo, so none is drafted (rule 10).
- Changing the mail body touches the sender route, which rule 2 puts off limits for this project; item 3 stays a proposal until the seat applies it.

## How to preview

`npm run dev`, then open `/dev/email-capture-preview` (404 in production builds). Use a local database; submitting writes a pending row.
