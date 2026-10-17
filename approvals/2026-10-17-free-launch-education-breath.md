# Keep /education and /breath hidden in the free launch?
status: WAITING_ON_JON
red: second-look
project: Reset Biology
one_click: hide education and breath
PR #55 ports the free-launch gate, off by default. The October boundary commit hid /education (library and peptide Librarian) and /breath because the 2026-10-06 ruling named only signup, peptides, meals, journal and audio. Breath is a working free tool and other PRs (#52) link to it, so hiding it would break those links when the flag is on. Built: the gate hides both today, flag off. On "hide education and breath": nothing changes. On "show education and breath": I drop the two prefixes from the list in src/lib/freeLaunch.ts (one-line PR).
