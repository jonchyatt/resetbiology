# Switch off the failing Cloudflare Pages check
status: WAITING_ON_JON
red: second-look
project: Reset Biology
one_click: yes pause cloudflare pages builds
red_note: the fix lives only in the Cloudflare dashboard, not this repo

The "Cloudflare Pages" check fails on every PR in about one second with "Build failed" (latest commit 2db060b on #46; the project is `reset-biology`, account 4bdc6662). The repo has no wrangler.toml, no .github workflows and no Pages config, so nothing here can fix or remove it. It comes from the Cloudflare GitHub app. Production deploys on Vercel and is unaffected. In the Cloudflare dashboard: Workers & Pages, reset-biology, Settings, Builds, turn off "Automatic deployments" for preview branches (or disconnect the Git repo). On no: the red X stays on PRs, harmless.
