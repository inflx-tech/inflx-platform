# INFLX — Item 2: Pitch & Invitation Settings

You are working in the INFLX codebase: backend (Node, `backend/src/**`, SQL migrations in `backend/migrations/**`), the Brand phone app, the Creator phone app, and the brand website/admin that share the same backend.

Two files come with this prompt:

1. **`INFLX_Master_Business_Rules_Phase_1_v1.9.docx`**: the business rules. Section **8A** is this item. Sections 5, 8, 25, 27 and 31 are related.
2. **`INFLX_Item2_Settings_Mockups.html`**: the locked mockups, screens B1–B8, C1–C6 and X1–X4. Open it in a browser.

**Order of authority:** rules doc → mockups → this prompt. If two of them disagree, stop and ask. Never guess.

---

## 0. How to work

- Work in **four phases**. **Stop after Phase 1** and wait for approval before changing any code or database.
- Follow the existing patterns in the codebase (controllers, services, migrations, navigation, theming, tests). Do not rewrite unrelated code.
- Migrations must be additive: no dropping or renaming existing columns or tables in this item.
- Phone apps ship as over-the-air updates. If anything needs a **new native module**, flag it in Phase 1 instead of adding it.
- Every rule in this prompt must be enforced **on the server**. The app also enforces it, but server-side is required.
- Cite `file:line` for every claim in the gap report.

### Words: rules doc vs code

| Rules doc says | Code says (from the 2026-09-09 audit) |
|---|---|
| Creator | `influencer` |
| Aim: Pay for Sale | `goal = 'conversion'` |
| Aim: Pay for Content | `goal = 'engagement'` |
| Aim: Hybrid | `goal = 'hybrid'` |
| Mode of Work: Store Visit | `shoot_mode = 'visit'` |
| Mode of Work: Remote | `shoot_mode = 'shipment'` |
| Creator pitch | `influencer_proposals` |
| Invitation (creator in a set) | `campaign_influencers` row |

The code also has `shoot_mode = 'remote'` ("no shoot"). The rules doc has **only two modes**, so settings must offer only Store Visit and Remote.

---

## 1. Aim of this item

INFLX has two ways into a collaboration: a **brand invites a creator** into a set, or a **creator pitches a brand**. This item lets each side control who can start one with them.

- **Brand → "Pitch settings"** (Brand app → Profile): who may send this brand a pitch.
- **Creator → "Invitation settings"** (Creator app → Profile): which brands may invite this creator.

These are **user-controlled** settings, not admin settings. The existing admin limits (rejection cooldown, pitch rate limits, 30-day pitch reply window, invitation cutoff) still apply on top and are **not** part of this item. Do **not** reuse `handshake_settings`, which is admin-level.

**Why it matters later:** item 5 (inviting creators) and item 8 (creator pitch) will call the eligibility check built here. This item builds:

1. The data and APIs for both settings pages and both blocked lists.
2. Both settings screens, with every state shown in the mockups.
3. The **public summary** shown on the other side: "Accepts pitches for…" on the brand overview and "Open to invitations for…" on the creator profile, including the disabled and blocked states and the Block action.
4. A server-side **eligibility service** that items 5 and 8 will use. Wire its hard checks into the existing pitch-create and invite-create endpoints now (see A7).

**Out of scope:**

- The full pitch flow and invite flow screens.
- The creator picker inside a set, including the "below minimum" warning UI (item 5).
- Any admin UI.

---

## 2. Phase 1 — Gap check (read only, no changes)

Read the backend, migrations, both phone apps, and any brand website or admin code that reads or writes the same data. Check every requirement below. For each one, report **Exists / Partial / Missing / Conflicts**, with evidence and the change you propose.

### 2.1 Data requirements

**D1. Brand pitch settings (one per brand)**

| Field | Type / values | Default | Rule |
|---|---|---|---|
| accepting | boolean | true | — |
| paused_at | timestamp, nullable | null | Set when turned off; cleared when turned on |
| accepted_aims | set of `conversion`, `engagement`, `hybrid` | all three | At least one |
| accepted_modes | set of `visit`, `shipment` | both | At least one |
| niche_ids | null = any, or list from the creator sign-up niche list | null | — |
| min_followers_instagram | integer ≥ 0, nullable | null | — |
| min_followers_youtube | integer ≥ 0, nullable | null | — |
| min_engagement_rate | numeric 0–100, one decimal, nullable | null | — |
| language_ids | null = any, or list | null | Same language list creators use |
| city_ids | null = any, or list of cities (state → city) | null | Same state/city list as brand branches |
| allow_past_creators | boolean | true | — |
| updated_at | timestamp | — | — |

**D2. Creator invitation settings (one per creator)**

| Field | Type / values | Default | Rule |
|---|---|---|---|
| open | boolean | true | — |
| paused_at | timestamp, nullable | null | Same as D1 |
| accepted_aims | set of three Aims | all three | At least one |
| accepted_modes | set of `visit`, `shipment` | both | At least one |
| visit_city_ids | list of cities (state → city) | the creator's own profile city | At least one when `visit` is accepted |
| brand_categories | null = any, or subset of the 8 major categories (D4) | null | — |
| min_fee_engagement | whole rupees ≥ 0, nullable | null | Pay for Content minimum fee |
| min_fee_hybrid | whole rupees ≥ 0, nullable | null | Hybrid minimum fixed fee |
| min_commission rows | rows of { aim: `conversion` or `hybrid`, category: one of the 8 codes or `ALL`, pct: 1–100 } | none | Per Aim **and** per industry. If brand_categories is null, only an `ALL` row is used. |
| updated_at | timestamp | — | — |

When a creator turns an Aim **off**, keep that Aim's minimums stored. They are hidden, not deleted, and come back when the Aim is turned on again. Likewise, commission rows for categories that are later unselected stay stored but are ignored.

**D3. Blocks (both directions)**

- Fields: blocker type and id (brand or creator), blocked type and id, created_at. Each pair is unique.
- A **brand blocking a creator** stops that creator pitching the brand.
- A **creator blocking a brand** stops that brand inviting the creator.
- The blocked party is **never told**. Everywhere they look, a block appears exactly like "paused".

**D4. Reference lists.** Find the current source of each list, or report it missing.

- **Creator niches:** the list creators pick after sign-up (Creator profile → content niche & preferences).
- **Languages:** the list creators pick in their profile.
- **8 major fashion categories** (also called "industries"): `MEN`, `WOMEN`, `KIDS`, `PLUS_SIZE`, `WATCHES`, `IMITATION_JEWELLERY`, `FOOTWEAR`, `BAGS_ACCESSORIES`. Display names: Men, Women, Kids, Plus Size, Watches, Imitation Jewellery, Footwear, Bags & Accessories.
  - **The brand's own category must use this same list.** Report how the brand's category is stored today and how it maps to these 8 codes.
- **State → city list:** one canonical list shared by brand branches, the brand's Cities filter and the creator's visit cities. Report how branch state and city are stored today (for example free text from Google address search) and what a canonical list needs.

**D5. Existing accounts.** Propose one approach and say why: either backfill default rows for every existing brand and creator, or treat a missing row as all defaults.

**D6. Creator data the eligibility check reads.** Confirm each exists and where:

- Niche(s), languages, profile city.
- Instagram follower count and YouTube follower count as **separate numbers**.
- Engagement rate.
- Whether the creator has a **previously signed agreement** with a given brand, meaning both signatures exist (used by allow_past_creators).

### 2.2 API requirements

| ID | Endpoint (follow existing naming) | Purpose |
|---|---|---|
| A1 | GET / PUT brand pitch settings (the signed-in brand's own) | Load and save B2–B6. PUT validates everything in §4 and returns field-level error codes. |
| A2 | GET / PUT creator invitation settings (own) | Load and save C2–C6, including minimum-commission rows |
| A3 | Brand blocked creators: list (name, avatar, blocked date), block, unblock | B7, X4 |
| A4 | Creator blocked brands: list, block, unblock | C6, X3 |
| A5 | Brand overview for a creator viewer: add `pitchSummary` = { acceptingLabelState, aims[], modes[], canPitch, reason } | X1, X2 |
| A6 | Creator profile for a brand viewer: add `inviteSummary` = { openLabelState, aims[], modes[], canInvite, reason } | X4 |
| A7 | Eligibility service (§3), called by the **existing** pitch-create and invite-create endpoints | Server-side enforcement |
| A8 | Reference lists: niches, languages, 8 categories, states → cities | Pickers |

**Privacy (A5, A6 and every error from A7):**

- Only ever return: paused/open status, accepted Aims, accepted modes, and a **coarse reason code**.
- Allowed reason codes: `OK`, `NOT_ACCEPTING` (used for both paused **and** blocked), `NOT_MATCHING`.
- **Never** return thresholds, lists, the other side's minimums, or whether a block exists.

**Wiring A7:** in Phase 1, report exactly where the existing pitch-create and invite-create endpoints are and **who calls them today**, including the brand website. Propose how to wire the check without breaking current callers.

### 2.3 Also report

- The open-pitches count for a brand (shown on B6 while paused). Which `influencer_proposals` statuses count as "open"? The audit says status is unconstrained text.
- Existing screens that B1, C1, X1 and X4 attach to: brand Profile, creator My Profile, brand overview in the creator app, creator profile in the brand app. Say which exist and which must be created.
  - If the brand overview or creator profile screen doesn't exist, propose a minimal header component with the summary and Block action, reusable in item 3.
- The existing theme and font setup, compared with §6 of this prompt.

### 2.4 Phase 1 output

Write **`Docs/ITEM2_SETTINGS_GAP_REPORT.md`** with:

1. **Requirement table:** ID · requirement · status · evidence (file:line) · proposed change · risk.
2. **Proposed migrations** (additive only).
3. **Proposed endpoints**, with request/response shapes and error codes.
4. **Proposed frontend files** to add or change, per app.
5. **Questions for the founder**, including every assumption in §3.4.

Then **stop and wait for approval.**

---

## 3. Eligibility rules (build in Phase 2)

### 3.1 Creator → Brand: `canCreatorPitchBrand(creator, brand, aim, mode)`

Check in this order and return the first failure:

1. Brand not accepting, **or** brand has blocked the creator → `NOT_ACCEPTING`.
2. `aim` not in the brand's accepted_aims, or `mode` not in accepted_modes → `NOT_MATCHING`.
3. If allow_past_creators is on **and** the creator has a previously signed agreement with this brand → `OK`. This skips step 4 only, never steps 1–2.
4. The brand's private filters. Each one is skipped when it is null or "any":
   - **Niches:** at least one of the creator's niches is in niche_ids.
   - **Followers:** if one or both minimums are set, the creator passes when **either** set platform meets its own minimum. Example: min Instagram 10,000 and min YouTube 5,000; the creator has 8,000 Instagram and 6,000 YouTube → pass.
   - **Engagement:** creator rate ≥ min_engagement_rate.
   - **Languages:** at least one shared language.
   - **Cities:** creator's profile city is in city_ids.
   - Any failure → `NOT_MATCHING`.
5. Otherwise → `OK`.

### 3.2 Brand → Creator: `canBrandInviteCreator(brand, creator, set, proposedTerms)`

1. Creator not open, **or** creator has blocked the brand → `NOT_ACCEPTING`.
2. The set's Aim is not in the creator's accepted_aims, or the set's mode is not in accepted_modes → `NOT_MATCHING`.
3. brand_categories is set and the brand's category is not in it → `NOT_MATCHING`.
4. Set mode is `visit` and none of the brand's branch cities are in the creator's visit_city_ids → `NOT_MATCHING`. This is an assumption; confirm in Phase 1.
5. Otherwise `OK`, plus **warnings**. Warnings never block.
   - `BELOW_MIN_FEE`: Aim Pay for Content and proposed fee < min_fee_engagement; or Aim Hybrid and proposed fixed fee < min_fee_hybrid.
   - `BELOW_MIN_COMMISSION`: Aim Pay for Sale or Hybrid and proposed commission is below the creator's minimum for that Aim:
     - If the creator picked brand categories, use the row for (that Aim, the brand's category). Step 3 already guarantees the category is one they picked.
     - If the creator picked none, use the (that Aim, `ALL`) row.
     - An empty or missing row means no minimum, so no warning.

### 3.3 Always true

- **Not retroactive:** changing, pausing or blocking never affects pitches or invitations already sent, negotiations in progress, or signed collaborations. A paused brand still answers its open pitches within the normal 30 days. A creator's existing invitations stay open until their set's cutoff.
- **Checked twice:** once when the other side views the screen (disabled button) and again on the server when a pitch or invitation is sent.

### 3.4 Assumptions to confirm in the Phase 1 questions

- Step 3.2.4: matching visit cities against the brand's branch cities.
- Step 3.1.3: allow_past_creators skips only the private filters, not Aims and modes.
- "Previously signed agreement" means both signatures exist on any earlier collaboration between the two.

---

## 4. Validation (server and app, same rules and same messages)

| Field | Rule | Error message (exact) |
|---|---|---|
| Aims (brand) | At least one | Pick at least one Aim. To stop all pitches, turn off Accepting pitches instead. |
| Aims (creator) | At least one | Pick at least one Aim. To stop all invitations, turn off Open to invitations instead. |
| Mode of work | At least one | Pick at least one mode of work. |
| Minimum followers | Whole number ≥ 0 or empty | Enter a whole number. |
| Minimum engagement rate | 0–100, one decimal, or empty | Enter a rate between 0 and 100. |
| Visit cities | At least one when Store Visit is on | Pick at least one city, or turn off Store Visit. |
| Minimum fee (either) | Whole rupees ≥ 0 or empty | Enter an amount in whole rupees. |
| Minimum commission (any row) | 1–100 or empty | Commission must be between 1 and 100%. |

- Errors appear **under the field** that caused them.
- The Save button stays disabled while there are errors, and the bar above it reads **"Fix N things above to save"** ("Fix 1 thing above to save" for one).
- Save is also disabled (grey) when nothing has changed.

---

## 5. Frontend (build in Phase 3): each screen, field and piece of data

Match the mockups screen by screen. All copy below is exact.

### 5.1 Brand app

**B1 · Profile tab → "Pitch settings" row**
- Subtitle: `{Accepting|Paused} · {all Aims | list of accepted Aims} · {Store Visit and Remote | Store Visit | Remote}`.
- Chip: green **On** when accepting, grey **Paused** when not.

**B2 · Pitch settings (new brand, everything open)**
- **Accepting pitches** switch. Hint: "Creators can send you pitches".
- **Aims you accept:** 3 chips, multi-select. Hint: "Creators see these on your brand overview."
- **Mode of work:** Store Visit and Remote chips, multi-select.
- Section **Who can pitch**. Hint: "Only you see these. Creators who don't match are told they don't meet your criteria."
  - **Creator niches:** "Any" or "N selected" → picker sheet (B4).
  - **Minimum followers:** two number fields, Instagram and YouTube. Hint: "Either platform is enough."
  - **Minimum engagement rate:** number with "%". Placeholder "No minimum".
  - **Languages:** "Any" or "N selected" → picker sheet (B4).
  - **Cities:** "Any" or "N cities in N states" → state-then-city picker (same component as C4/C4b).
  - **Always allow past creators** switch. Hint: "Creators you've signed with can pitch even if they don't match. Not if you've paused or blocked them."
- **Blocked creators** row: "None" or count → B7.
- Sticky **Save changes** button: yellow when enabled, grey when disabled.

**B3 · Editing with errors:** §4 messages and save-bar count.

**B4 · Picker sheet (niches, languages)**
- Title, **Clear** (back to Any), search field, checkbox list, button **"Apply · N {niches|languages}"**.
- Niche hint: "From the niches creators choose when they sign up."

**B5 · Pause confirm sheet** (opens when the switch is turned off; nothing changes until confirmed)
- Title: "Pause pitches?"
- Body: 'Creators will see "Not accepting pitches right now" on your brand overview and can't send new pitches.'
- Info box: "Pitches you've already received stay open. You still have 30 days to answer each one."
- Buttons: **Pause pitches** (primary), **Keep accepting** (secondary).

**B6 · Saved, and paused**
- Toast: "Pitch settings saved."
- Grey banner: "Pitches paused" / 'Creators see "Not accepting pitches right now". {N} open pitches still need your answer.'
- Switch hint: "Paused since {date}".
- The other settings stay visible but dimmed, with hint "Kept for when you turn pitches back on."
- Row **Open pitches** → Creators tab → Pitches. If that screen doesn't exist yet, use a placeholder route.

**B7 · Blocked creators**
- Hint: "Blocked creators see you as not accepting pitches. They aren't told they're blocked."
- Rows: avatar, name, "Blocked {date}", **Unblock** → toast "{Name} unblocked."
- Footer hint: "To block someone, open their profile and tap ⋯ → Block."
- Empty state: "No blocked creators" / "Block a creator from their profile if you never want pitches from them."

**B8 · States (same four apply to C screens)**
- **Loading:** skeleton.
- **Couldn't load:** "Couldn't load your settings" / "Check your connection and try again." / **Try again**.
- **Saving:** spinner in the button, "Saving".
- **Save failed:** toast "Couldn't save. Your changes are still here, so try again." Edits are kept.
- **Leaving with unsaved changes:** "Discard changes?" with **Discard** and **Keep editing**.

**X4 · Creator profile (brand app)**
- Card "Open to invitations for" with Aim and mode tags.
- **Invite to a set** button, which stays disabled in this item (item 5 wires it).
- When `NOT_ACCEPTING`: grey banner "Not taking invitations right now" / "You can still view {first name}'s posts.", button disabled.
- ⋯ menu → **Block {Name}** → confirm sheet:
  - Title: "Block {Name}?"
  - Body: "They won't be able to pitch you. They won't be told. Collaborations you've already signed carry on."
  - Buttons: **Block creator** (danger) / **Cancel**.
  - After: toast "{Name} blocked." with **Undo**.

### 5.2 Creator app

**C1 · My Profile → "Invitation settings" row**
- Subtitle: `{Open|Paused} · {Aims} · {modes}`, with On/Paused chip.
- Payout and tax details move to **Wallet**. If they currently live in Profile, list that in the Phase 1 report; don't move them in this item unless approved.

**C2 · Invitation settings (new creator)**, in this order:
1. **Open to invitations** switch. Hint: "Brands can invite you to their sets".
2. **Aims you accept:** 3 chips. Hint: "Brands see these on your profile."
3. **Mode of work:** 2 chips.
4. **Cities you can visit:** shown **only when Store Visit is selected**. Defaults to the creator's own city → C4/C4b.
5. **Brand categories:** 8 chips, multi-select. Hint: "None picked means any category. Only you see this."
6. **Your minimums, by Aim.** Hint: "Only you see these. Brands can still invite below them, with a warning." One card per **selected** Aim:
   - **Pay for Content** ("fixed fee"): ₹ field, placeholder "No minimum".
   - **Pay for Sale** ("commission by industry"): one % row per selected brand category. If none are selected, a single "All industries" row with hint "Pick brand categories above to set a rate per industry."
   - **Hybrid** ("fixed fee + commission"): ₹ field (placeholder "No minimum fixed fee") plus the same per-industry % rows.
7. **Blocked brands** row.
8. Save bar.

**C3 · Editing with errors**
- §4 messages.
- Info box: "Turning an Aim off hides its card. The numbers are kept if you turn it back on."

**C4 / C4b · State → city picker** (shared component, also used by the brand Cities filter)
- **Step 1:** search "Search a city or state", selected cities as removable chips, list of states with a "{N} selected" chip, button "Apply · N {city|cities}".
- **Step 2:** back button, state name, **Select all**, search "Search cities in {State}", checkbox city list. Back keeps the choices.
- Searching from step 1 shows results as "{City} · {State}".

**C5 · Pause confirm sheet**
- Title: "Stop taking invitations?"
- Body: 'Brands will see "Not taking invitations right now" on your profile and can't invite you.'
- Info box: "Invitations you already have stay open until their set's cutoff. Your active collaborations carry on."
- Buttons: **Stop invitations** / **Stay open**.

**C6 · Saved, with public preview**
- Toast: "Invitation settings saved."
- Card "Brands see on your profile": Aim and mode tags. Hint: "Your categories, cities, minimum fee and commission stay private."
- Summary rows:
  - Brand categories.
  - "Your minimums", e.g. "Content ₹8,000 · Sale 12% · Hybrid ₹5,000 + 10%". For several industry rates, show the lowest–highest range.
  - Blocked brands.
- Blocked brands empty state: "No blocked brands" / "Block a brand from its brand overview if you never want invitations from it."

**X1 / X2 · Brand overview (creator app)**
- **OK:** card "Accepts pitches for" with tags, and a **Pitch this brand** primary button. It stays non-functional in this item; item 8 wires it.
- **`NOT_ACCEPTING`:** banner "Not accepting pitches right now" / "You can still view products and posts.", button disabled.
- **`NOT_MATCHING`:** banner "You don't match this brand's pitch criteria" / "Brands can set things like audience size or city. Growing your profile may change this.", button disabled.

**X3 · Block a brand** (⋯ menu)
- Confirm sheet title: "Block {Brand}?"
- Body: "They won't be able to invite you. They won't be told. Collaborations you've already signed carry on."
- Buttons: **Block brand** / **Cancel**.
- Toast: "{Brand} blocked." with **Undo**.

---

## 6. Look and feel

Use these tokens. Put them in the apps' theme; screens reference token names, never raw hex.

```js
colors = {
  bg:'#FFFFFF', surface:'#F6F6F3', border:'#E5E4DE',
  ink:'#1A1A17', ink2:'#5B5A53', ink3:'#77766E',
  primary:'#FFC700', primaryPressed:'#F0B400', primarySoft:'#FFF3C4', onPrimary:'#1A1A17',
  disabledBg:'#EFEFEA', disabledText:'#A3A29B',
  state:{ yourMove:{fg:'#B04600',bg:'#FFEBDD'}, waiting:{fg:'#1D5FBF',bg:'#E6EFFC'},
          active:{fg:'#1A7A3D',bg:'#E4F5EA'}, completed:{fg:'#6A3FC6',bg:'#EFE8FC'},
          declined:{fg:'#C42B2B',bg:'#FDE8E8'}, disputed:{fg:'#FFFFFF',bg:'#A51D2D'},
          ended:{fg:'#55544D',bg:'#EFEFEA'} }
}
```

- **Font:** Plus Jakarta Sans.
- **Yellow** is only for the one main button on a screen.
- **Switches:** ink when on, grey when off.
- **Selected chips:** ink background with white text and a check. Unselected chips: white with a border.
- **Aim and mode tags:** neutral outline, never colored.

---

## 7. Phase 2 (backend) and Phase 3 (frontend), after approval

- **Phase 2:** migrations, models, validation, endpoints A1–A8, the eligibility service, and wiring into the existing pitch-create and invite-create endpoints as approved.
- **Phase 3:** both apps' screens B1–B8, C1–C6, X1–X4 and the shared state-then-city picker, using §5 and §6.

---

## 8. Phase 4: tests and final functionality

### 8.1 Automated tests (existing test setup)

- **Eligibility:** one test per rule in §3.1 and §3.2, plus these cases:
  - Either-platform followers pass.
  - Allow-past-creators skips the filters but not pause or block.
  - Blocked returns `NOT_ACCEPTING`, never a block-specific code.
  - Commission uses the brand's category row when the creator picked categories, and the `ALL` row when they picked none.
  - Warnings never block.
- **API:** every §4 validation returns the right field code; A5/A6/A7 responses never contain thresholds, lists or block info.
- **Persistence:**
  - Turning an Aim off and on keeps its minimums.
  - Unselected-category commission rows are kept but ignored.
  - Defaults for new and existing accounts follow the approved D5.
- **Apps:** each screen renders loading, error, default, errors, saving, saved and paused states.

### 8.2 Final functionality: all must pass on a real phone

1. A new brand opens Pitch settings: everything is open and Save is grey. A creator sees "Accepts pitches for: Pay for Sale · Pay for Content · Hybrid · Store Visit · Remote" and an enabled Pitch button.
2. The brand unselects all Aims: the error appears and saving is impossible.
3. The brand sets Instagram minimum 10,000. A creator with 8,000 Instagram and 12,000 YouTube, but no YouTube minimum set, **fails**. After the brand also sets YouTube minimum 10,000, the creator **passes**.
4. A creator who fails a filter sees "You don't match this brand's pitch criteria". A direct API pitch attempt is rejected with `NOT_MATCHING`, and no threshold appears anywhere in the response.
5. The brand pauses, with the confirm sheet: creators see "Not accepting pitches right now". A pitch sent before the pause can still be answered.
6. The brand blocks a creator: that creator sees exactly the paused view, gets no notification, and unblocking restores normal behaviour.
7. A creator with a past signed agreement pitches a brand whose filters they fail, with allow past creators on: allowed. If the brand is paused: not allowed.
8. A creator selects all three Aims and Women + Imitation Jewellery, then sets: Content ₹8,000, Sale Women 12%, Hybrid ₹5,000 + Women 10%. Saving works and C6 shows the summary. Turning Hybrid off and on brings back ₹5,000 and 10%.
9. A creator with Store Visit on and no cities cannot save.
10. The eligibility service returns `NOT_MATCHING` for a Watches brand inviting a creator who picked only Women.
11. A Pay for Content invite at ₹6,000 to a creator with an ₹8,000 minimum: `OK` with `BELOW_MIN_FEE`.
12. The creator picked Women + Imitation Jewellery, with Sale rows Women 12% and Imitation Jewellery empty. A Women brand inviting at 8% → `BELOW_MIN_COMMISSION`. An Imitation Jewellery brand at 8% → no warning. A creator who picked no categories, with ALL 5%: a Footwear brand at 4% → `BELOW_MIN_COMMISSION`.
13. Changing any setting after an invitation or pitch is sent does not change that invitation or pitch.
14. Settings fail to load: retry works. Save fails: the edits are still on screen.

### 8.3 Final deliverable

A short summary covering:

- What changed (migrations, endpoints, services, screens).
- Test results.
- How to try items 1–14 on a phone.
- Anything left open.
