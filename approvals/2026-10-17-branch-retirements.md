# Delete retired remote branches

- Red: 4 (cannot be undone). Rule 7 also forbids cloud threads from deleting.
- Ask: delete the 41 branches marked retire in `docs/BRANCH-TRIAGE-2026-10.md` that are "fully in master". Branches named `t_*`, `card/*`, `woden/*`, `harden/*` belong to live local workers and are excluded unless Jonathan says so.
- Built so far: the triage table with ahead/behind counts and merge checks.
- Not verified: which branches live workers use right now; branch protection.
- If approved: local seat runs the deletes from the table's retire rows.
