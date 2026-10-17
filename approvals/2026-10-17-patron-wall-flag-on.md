# Turn on the patron wall page
status: WAITING_ON_JON
red: 3
project: Reset Biology
one_click: turn on patron wall
The /patrons page is built and hidden behind NEXT_PUBLIC_RB_PATRON_WALL. It lists only people marked consented, and the list is empty today, so on yes it would publish "Our first patrons will be named here" under the Reset Biology name. It needs you because that is a public page, and because you choose tier names and how people pay (no payment link exists). Built up to the line: page, empty state, consent filter, noindex, test, and docs/patrons/PATRON-WALL-SPEC.md. On yes: set the flag in Vercel yourself, then add names with written consent. On no: the page stays a 404.
