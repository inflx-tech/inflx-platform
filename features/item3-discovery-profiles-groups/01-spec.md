# item3-discovery-profiles-groups — spec

**Item 3 of the brand + creator rebuild.** Rules doc `INFLX_Master_Business_Rules_Phase_1_v1.11.docx`
§5A (creator groups) with §8A and the vocabulary in §5, 8, 25. Locked mockups:
`04-preview/mockups/item3-discovery-locked.html` (A1–A9, D1–D5, G1–G7, P1–P4, F1–F3, O1–O4).
Build prompt: `PROMPT.md`. Founder approval, 19 answers and the extra decisions: `APPROVAL.md`.
Phase 1 survey: `Docs/ITEM3_DISCOVERY_GAP_REPORT.md`.

**Scope (founder §0): the Brand and Creator phone apps only.** The brand website is not changed; every
extended endpoint keeps its old response as a superset; the server rules now apply to every caller
(website side effects are listed in `06-diff/notes.md`).

## What exists (before)

- Both phone apps were stripped to a single Profile screen on 2026-09-10 (`features/profile-only-apps`).
  Item 2 added the settings screens behind that profile and two temporary "find a creator / find a
  brand" doors so the other side's profile could be reached at all.
- The brand profile was an inline form: business name, GSTIN, a pasted logo URL, one "Main Branch" and
  extra branches typed as free text into `listing_data.branches[]`. Creators typed their city as text.
  `ref_states` held 17 states and 63 cities.
- A brand could not browse creators on the phone. `/influencers/search` (website) listed pending
  creators and hard-coded `is_inflx_verified = TRUE`; `/influencers/:id` answered any brand about any
  creator. `/brands/:id/public` returned the street address. The shopper store passed the whole
  `listing_data` (branches, phones) to any caller. The find-brands facets exposed `accepts_proposals`.
- Groups existed (migration 123, website "Shortlist") with no name rules, no cap, and pending or
  suspended creators counted as members.

## What a person can do after

**Both apps** open on five bottom tabs. Tabs that arrive in later items show a coming-soon screen with a
working button (§6.1 copy, exact).

**Brand → Creators tab**
- **Discover (D1/D2):** every approved creator, "Open to invitations" on by default, search by name or
  @handle, filters (niche, Instagram, YouTube, engagement, city, language, Aims, modes — at least one
  of the chosen values), sorts (most followers = higher of IG/YT, highest engagement, newest), pages of
  20, the live "Show N creators" count. Each card: avatar, name, niche · city · languages, three numbers,
  the accepted Aim/mode tags or a status chip (Open · Not taking invitations · Not open to your brand),
  and a grey **Blocked by you** chip when this brand blocked her (she is never hidden).
- **Groups (G1–G7):** per-brand groups, name 1–40 unique per brand (case-insensitive), 100 creators,
  add from Discover (select mode, all filters) or Worked with, from a card's ＋ or from her profile
  (G6 sheet: tick/untick many groups, create a new one inline), remove, rename, delete. Suspended
  creators are hidden but kept; rejected creators' rows are deleted; only approved creators can be added.
- **Pitches:** coming-soon empty state (item 8).
- **Worked with (W1):** creators with at least one contract signed by both sides, grouped, newest
  signature first, searchable.
- **Creator profile (P1–P4):** handles, measured numbers with "updated {d Mon}", "{N} collaborations
  signed on INFLX" (all brands, hidden at 0), "In your groups: …", Open-to card or the two grey banners,
  Invite (coming soon), Add to group, "Collaborations with you" (this brand's both-signed only, with
  the state family chip), posts grid (empty until item 13), Open Instagram / YouTube, ⋯ Block / Unblock.

**Brand → Profile tab (A1–A5)**
- A1 is a row list with the logo, name, "Fashion · {main city}" and account status. Orange reminders
  when sub-categories or the main branch city are missing.
- A2 Business details: logo upload (JPG/PNG ≤ 5 MB, checked in the app and again on the server),
  brand name*, About (≤ 200), contact person*, GSTIN, login phone masked and major category locked.
- A3 Sub-categories, A4 Branches (Main chip, Edit, Open in Maps, Remove — the main branch cannot be
  removed), A5 Add/Edit branch with Google address search that resolves to a canonical state + city
  (new cities are added once, `source='google'`; unknown states are refused with the exact message and
  logged). Links (website, Instagram). Brand overview (O4: "This is what creators see."). Pitch
  settings and Legal stay.

**Creator → Collabs tab (F1–F3)**
- Four segments with empty states, the "Pitch a brand" card → **Find brands**: approved brands, "Brands I
  can pitch" on by default, the same status vocabulary (Accepting · Not accepting · You don't match),
  category / city (any branch) / Aims / modes filters, sorts (newest, A–Z, most products), search.
- **Brand overview (O1/O2):** header, about, Accepts-pitches card or banner, Pitch (coming soon),
  published products at list price with the out-of-stock rule, posts (empty), branch cities only, links.
  **Product detail (O3):** images and sizes from `variants_json`, unavailable sizes struck through,
  no buying.

**Creator → Profile tab (A7–A9)**
- A7 row list (photo, name, @handle, status): Profile info, Niche & languages (warning when none),
  Invitation settings, Payment & tax (its own screen, same content), Legal, Log out. The decorative
  notifications switch is gone.
- A8 Profile info: photo (≤ 5 MB), full name*, bio (≤ 150), city through Google, Instagram locked,
  YouTube, measured numbers read-only with the updated date.

**Server rules for every caller**
- Creator search, detail, Discover, groups and Worked with are approved-only; `/influencers/:id` is 404
  to a brand for a non-approved creator.
- Privacy: the brand overview and shopper store never carry addresses, phones, GSTIN, contact person
  or `listing_data.branches`; status reasons stay coarse (a block looks like paused); groups are
  invisible to creators; another brand's group is 404.
- Reference data: all 36 states and union territories seeded from the founder's CSV (92 cities after
  seeding), state alias table (NCT of Delhi → Delhi, …), cities auto-added from Google only.

## Out of scope

Inviting a creator or a group to a set (item 5), pitching (item 8), campaigns, wallet, home, shoppable
posts (item 13), the measured-numbers refresh job (item 3b), the website (separate discussion), admin
screens, Maestro device runs.
