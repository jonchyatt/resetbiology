# Turn on email capture
status: WAITING_ON_JON
red: 3
project: Reset Biology
one_click: yes email capture on

Turning on NEXT_PUBLIC_RB_EMAIL_CAPTURE shows a signup card to signed-in members who are not yet subscribed. It collects email consent under the Reset Biology name, so it is yours to do. Built up to the line: PR #50 is merged (card, flag-off render test, local-only preview, copy draft in docs/email-capture/DOUBLE-OPT-IN-COPY.md). The existing /api/newsletter route already sends a confirmation mail, and the newsletter sender is untouched. Open: the three proposed copy changes are not applied. On yes: the local seat checks the sender and sets the flag. On no: the card never renders.
