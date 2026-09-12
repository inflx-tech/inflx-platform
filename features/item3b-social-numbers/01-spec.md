# item3b-social-numbers — spec

**Item 3b of the brand + creator rebuild.** Rules doc `INFLX_Master_Business_Rules_Phase_1_v1.12.docx`
§2A (Creator Social Numbers, new) with §5A and §8A. Locked mockups:
`04-preview/mockups/item3b-social-numbers-locked.html` (S1–S5 brand, R1, R3–R6 creator, rules table).
Build prompt `PROMPT.md`; founder approval, 17 answers and changes `APPROVAL.md`;
Phase 1 survey `Docs/ITEM3B_SOCIAL_NUMBERS_GAP_REPORT.md`.

## What exists (before)
- Instagram followers and engagement were written once, **at registration, before approval**, by the
  old sync Apify helper (or by the admin spreadsheet import, or the mock fixture); never refreshed.
  YouTube read one channel total at registration and was measured for 0 of 25 production creators.
- No schedule, no posts, no averages, no run log, no costs, no account states, no ownership check on
  a changed handle. A YouTube handle could be changed silently. A creator could not exist without an
  Instagram handle (NOT NULL column, claim flow keyed on it).
- Registration also fired the n8n "A2 profile scraper" webhook before approval.

## What a person can do after
**Creator**
- Registers in two steps: details, then "Your social accounts" — Instagram username and/or YouTube
  handle or channel link, at least one, format checked with the exact messages. Nothing is measured
  or scraped until admin approves.
- Sees **Your numbers** (a new row on My Profile with a Fix / Waiting / Measuring chip): a card per
  platform with the measured numbers and when each part was measured and when posts update next, or
  the exact state copy with one action (Fix username → Profile info, "It's public now, check again"
  once a day, Add).
- Changes, adds or removes a handle on Profile info; after approval a sheet asks first, the old numbers
  leave the profile at once, the new handle waits for INFLX's ownership check and is measured only
  after admin confirms it. The last handle cannot be removed.

**Brand**
- On a creator's profile: one **platform card** per added platform (Instagram: engagement, avg reel
  views, posts in 90 days; YouTube: avg video views, avg shorts views, uploads in 90 days), each opening
  a **detail screen** with every number, the 90-day window, the post mix, the formula and the measured
  dates. States: normal · "Numbers are being updated" · "Numbers not available" (no reason) ·
  last good numbers with "Updated {date}". Discover cards are unchanged and read the refreshed numbers.

**Server**
- A measurement pipeline: accounts with states, a full run on approval and on handle confirm, profile
  numbers every 7 days, the 90-day posts every 15 days, Check again once a day, admin Measure now;
  Apify runs through an async runner with the run id and the cost recorded; retries the next day and an
  admin flag after 3 failures; a monthly budget guard (US$5, all INFLX runs, from Apify's own usage);
  Apify credit refusals recorded as `budget`, never as the creator's failure; a 500-item ceiling flagged.
- Instagram numbers: posts measured and per week, mix, last post, averages (hidden likes out),
  engagement = (likes + comments) ÷ views across the measured reels. YouTube: long videos and shorts
  split by the channel tab, each with count, averages and engagement on views; streams never counted.

**Amendment, 2026-09-12 (founder decision, after the first live creator read 86%).** Two rules changed:
1. **Engagement divides by views, not followers.** Instagram pushes reels far past a creator's own
   followers, so likes ÷ followers reports a number that is arithmetically right and commercially
   meaningless (192K followers, 3.4M average reel views, 86%). Reels are the only Instagram format the
   scraper returns views for; a creator who posted no reels falls back to followers and the screen says
   so. This is what the YouTube half of this feature already did, so both platforms now agree.
2. **The numbers come from the newest 30 posts inside the 90-day window**, not every post in it. A fixed
   count gives every creator the same statistical weight and is what the market's audit tools do. The window still bounds freshness, so a dormant creator is measured on whatever little she has.
   The cap is a statistics rule, not a fetch rule: asking the actor for exactly 30 posts was measured
   on 2026-09-12 and does not return the newest 30, so we still fetch the window and cap in code.
- The five legacy number columns are written only by the pipeline after a real run and cleared on
  change / add / remove / not found / private / rejected — and on release for every existing creator
  (today's numbers were never measurements).
- Minimal admin: Handle checks tab (Confirm / Reject), flags with Measure now, a Social numbers
  panel and Measure now on the creator page, the month's Apify cost on Analytics.

## Out of scope
Top posts, growth charts, code-in-bio ownership, other platforms, creator notifications, brand website
screen changes, the n8n workflow itself (kept, just not called at registration).
