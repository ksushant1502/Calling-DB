# Yulu Telecaller Dashboard

Static site, no build step. Left-sidebar layout; pages in this order:
1 Overview · 2 Campaign Types · 3 Agents · 4 Insights & VoC · 5 Flags · 6 Conversions

## Files
- index.html — page shell (sidebar + main area + script list)
- css/styles.css — all styling
- js/config.js — Supabase keys, campaign types, LOBs, keyword lists, agent-name map, excluded campaigns, CAMPAIGN_MAP, CORE_CALLERS (the 24 callers — paste names here)
- js/state.js — shared variables and the sidebar page list (TABS)
- js/shell.js — sidebar menu, date and type filters, upload buttons
- js/router.js — loads data for a page and draws it
- js/data.js, aggregation.js, coverage.js, utils.js, auth.js — data loading, roll-ups, upload-status strip, helpers, login
- js/tab-overview.js, tab-campaigns.js, tab-agents.js, tab-insights.js, tab-flags.js, tab-conversion.js — one file per page
- js/upload-calls.js, upload-conversion.js — CSV uploads
- js/main.js — starts the app (loaded last)

## Deploy
Upload index.html + css/ + js/ to the GitHub repo (same folder structure). GitHub Pages / Netlify publishes it.


## Build mode vs login
`js/config.js` has `REQUIRE_LOGIN`. While it is `false` (build mode) the site opens without a login, anyone with the link can upload, and phone numbers/notes are not saved. When the site is finished: run the "lock again" SQL, create user accounts in Supabase, and set `REQUIRE_LOGIN = true`.
