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


## Two kinds of report: campaign vs queue
Enterprise, Survey and City calling are dialled through **campaigns** (Campaign_Name column). Retention calling is dialled through **queues** (Queue_Name column).
In the upload window choose "Campaign report" or "Queue report (Retention)". Queue reports are saved in their own tables (`queue_days`, `queue_day_rows`) so they never overwrite a campaign upload for the same date; the dashboard adds the two together per day. The five retention queues are listed in `QUEUE_NAMES` and `CAMPAIGN_MAP` in `js/config.js`. Run `supabase_queue.sql` once to create the tables.


## Conversion uploads
The conversion upload takes a From / To date (or blank = every date in the file). Each conversion is counted on the Date column chosen on the mapping screen (default `campaign_date`, the day of the call). A row counts only if (1) `conversion_flag = 1`, (2) the disposition is a connected call, and (3) payment date and payment time are both present. `reservation_activation` = New, `reservation_extension` = Renewal. City codes (BLR, DEL, …) are shown as city names.


## Upload Status page
The green/red "which dates are uploaded" boxes now live on their own sidebar page, **Upload Status** (below Conversions), with one section each for the campaign report, the queue report and the conversion file. The code is in `js/coverage.js`.
