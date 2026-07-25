# Before/after — concept-stagea-posts-ui

## The center tab (the one visible change in the old app)
- **Before:** "Reels" FAB → a 38-line static placeholder ("coming with the
  Reels feature").
- **After:** "Posts" FAB (image icon) → the new Posts pillar: white full-
  bleed card feed → full-screen viewer → Shop sheet → existing commerce.

## Against the locked board (mockups/stage-a-locked-board.html)
Matches: pure white canvas, full-bleed media, creator row + concept chip,
tags-in-feed per style, yellow Shop bar with white text, compact engagement
row on cards, Reels-style right rail in full-screen, dots, caption
grammar, concept name as viewer header context.
Translations (documented in workflow-prediction): natural-ratio-within-
bounds rendering instead of the board's fixed-ratio demo phones; 'minimal'
style = price-only pills; unavailable products dimmed in the sheet (board
didn't cover the unavailable state).

Capture note: on-device screenshots land with the founder's device verify
(prod has no posts to photograph until the pilot).

## Follow-up (founder device test, 2026-07-23 evening)
Founder's creator account (old bundle) showed CampaignProducts with no path
to the composer. Fix: prominent dark "📸 Create Post with these products"
CTA above the product list (navigates Home→PostComposer), info banner
reworded to the post-first model. Legacy note UI stays as a secondary
annotation for now (removal rides Stage C cleanup). Note: founder's
screenshot showed the pre-2026-06-14 label, proving the device had not yet
applied the OTA — double-relaunch guidance given.

## Follow-up 2 (founder device test, composer polish)
Bugs: (1) category picker EMPTY — the composer fetched the tree via a
non-exported helper (require('../../config/api').getBaseUrl is not a module
export); the silent catch hid it. Fixed through the api client
(influencerApi.getListingTree) + an explicit couldn't-load state.
(2) Disabled CTA unreadable (0.35 fade) → 0.55.
Design (founder: "flow should be neat clear steps; 100 brands can't be
chips"): 5-segment yellow step-progress bar under the header with step
names; brand chips → searchable list rows with selection state + count;
category modal gains autofocus search over the 195 leaves.

## Follow-up 3 (founder device test — pin anatomy)
Founder: long product names clipped off-screen; people shop on PIC + PRICE.
Pin restyled to the reference (LTK) anatomy in BOTH the composer preview and
the follower components: dark circular bag icon + name truncated at ~18
chars with an ellipsis + PRICE BOLD on its own line below; x/y clamped
(14-86% / 5-93%) so a pill can never hang off the screen edge.

## Follow-up 4 (first real post in the queue!)
@sagartravel's "Monsoon T-Shirt" surfaced an admin bug: the Approve button
used bg-green — a colour that DOES NOT EXIST in the brand-web palette (navy/
orange/gold/teal/red/purple only) → transparent bg + white text = invisible
on the white card. Only red Reject showed. Fixed to the real success token
(bg-teal); the silently-unstyled bg-green-pale/text-green status pills on
the concepts + collections pages fixed the same way.

## Follow-up 5 (founder: "discover, posts and videos kind home is not coming")
The Posts tab now carries the LOCKED home grammar: INFLX wordmark + three
top tabs Discover · Posts · Videos. Posts = the live feed; Discover and
Videos show honest coming-soon states (Stage B layout / video phase). The
old Home keeps the Home slot until Stages B/C replace product browsing +
orders entry — the takeover is deliberate and staged, not forgotten.

## Follow-up 6 (first post LIVE on founder's follower phone)
Historic: the Monsoon T-Shirt card rendered end-to-end. Two founder notes:
(1) old pin style on screen = device on v199/v200 (pin anatomy is v201,
3-tab header v202) — relaunch pulls latest, no code change; (2) caption had
no way to read the full text → Instagram-style "… more"/"less" toggle added
to PostCard (expands in place; viewer always shows full caption).
