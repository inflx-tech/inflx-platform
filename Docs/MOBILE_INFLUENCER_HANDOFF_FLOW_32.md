# INFLX mobile-influencer bucket — handoff for Flow 32 window (v1 · 2026-05-26)

> **Drop this entire file as the first prompt in the new window.** OR have it Read the file directly via `Read C:\WORK\inflx-platform\Docs\MOBILE_INFLUENCER_HANDOFF_FLOW_32.md`. Engineered so the new window picks up cold without losing context.

---

## 0 · ONE-LINE STATE

**Mobile-brand bucket COMPLETE (16/16). Mobile-influencer bucket 4/23 shipped (Flows 28, 29, 30, 31 live). Flow 32 IN-FLIGHT — mockup authored + locked design decisions captured, but `lock` confirmation + execution NOT yet done. `origin/main` HEAD = `e971b38` (Flow 31 close-out). StatusPill canonical map = 43 entries. NATIVE_RUNTIME=2 baked into installed APKs (Flow 28 native rebuild).**

---

## 1 · IDENTITY

You are **Window B continued** on INFLX's parallel two-window setup. Founder = solo dev on `C:\WORK\inflx-platform\` (aveenswamy1989@gmail.com). Chat-architect / Code-builder orchestration. Prod-as-staging.

**This window (you)** — UI/UX redesign rollout for mobile-influencer bucket. Picking up at Flow 32 mid-flight.

**Window A (parallel)** — Revenue model / backend. May push since `e971b38`. Always `git fetch` before suspecting regressions.

## 2 · WORKING DIRECTORY (CRITICAL GOTCHA)

Bash tool's cwd is `C:\WORK\` — NOT the repo. **Every git/pnpm command MUST prefix with**:

```bash
cd /c/WORK/inflx-platform && <command>
```

**Cwd persistence is UNRELIABLE** — sometimes inherits from prior `cd`, sometimes resets between Bash calls (especially after `run_in_background` tasks return). **Always prefix critical commands with `cd /c/WORK/inflx-platform &&`**. Lost retry cycles in prior windows ignoring this.

Read/Write/Edit/Glob/Grep tools use absolute paths and work fine with `C:\WORK\inflx-platform\...`.

---

## 3 · FIRST 6 ACTIONS FOR NEW WINDOW

```bash
# 1. Confirm repo state — expect HEAD = e971b38 (Flow 31 close-out)
cd /c/WORK/inflx-platform && git log --oneline -10 && git status --short
```

Expected HEAD: `e971b38 chore(release): Flow 31 — backfill deploy.commit = 3f402ee ...`. Working tree should show:
- `?? design/wave2/flow-32-influencer-mobile-completion-store/` (mockup awaiting lock)
- Older untracked dirs from prior sessions (ok, ignore)

2. **Read GOVERNANCE.md + CLAUDE.md + Docs/OTA_WORKFLOW.md + LOCAL.md** in parallel (4 reads).

3. **Read this whole handoff** (you may already have it as context).

4. **Surface to founder**:

> Resumed Flow 32 from handoff. HEAD = `e971b38`. Mobile-influencer bucket 4/23 shipped. **Flow 32 mockup is at `design/wave2/flow-32-influencer-mobile-completion-store/web.html` — all 4 design calls already answered by founder; mockup awaiting your `lock` confirmation.** Once you say `lock` I'll execute: mirror mockup → write 7 artifacts → implement 3 screens → web QA → publish-ota:all → close-out commit. Or call out tweaks first.

**Do NOT auto-execute** — Flow 32 needs explicit founder lock per the locked rhythm.

---

## 4 · THE LOCKED 5-STEP RHYTHM (every flow, no exceptions)

Locked by founder 2026-05-23. Non-negotiable per-flow pipeline:

1. **Select flow** — agent proposes; founder confirms.
2. **Agree on look + UX** — HTML mockup at `design/wave2/flow-N-<slug>/web.html` + mirror under `features/<slug>/04-preview/mockups/web.html`.
3. **Impact verdict (TERSE — one line in chat)** — `"zero functional / backend / logic / DB impact — visual + UX only."` Full mechanics in `features/<slug>/05-impact.md`.
4. **Implement** — code change against locked mockups; preserve all NO-TOUCH; dual-probe pre-warm + `pnpm qa` for 76/76 GREEN.
5. **Deploy** — `pnpm publish-ota:all` (single Node process, 3 audit registrations per `feedback_ota_publish_strategy`). Close-out commit flips `lock.json release.released=true`.

**Standing autonomy**: deploy-inert work + design/lock decisions don't need permission. Production-impacting (OTA/Render/Vercel) DOES get explicit go.

**gov-check schema gotcha**: lock.json wants `release.deploy` NOT `release.deploy_evidence`. Mobile flows ALSO need `release.maestro_green: true` (Rule 5) when flipping `released=true` if any `Packages/Mobile/src/**` is touched. Override via `GOVERNANCE_OVERRIDE="reason"` env var on push — loud, never silent.

**gov-check contract completeness**: lock.json wants `01-spec.md`, `02-workflow.md`, AND `05-impact.md`. Plus `04-preview/mockups/web.html` mirrored. Plus `04-preview/workflow-prediction.md` (recommended). Plus `06-diff/notes.md` (Rule 4). Plus `03-expected-outputs.md` for completeness. **Always write ALL 7 artifacts** before first push attempt.

---

## 5 · MOBILE-INFLUENCER BUCKET STATE (4/23 shipped)

### Shipped (4 flows = 9 screens + 1 navigator)

| # | Flow | Screens | Status | OTA versions (after) | Close-out commit |
|---|---|---|---|---|---|
| 28 | Home + Notifications + Navigator (FOUNDATION + MCI native rebuild) | HomeScreen, NotificationsScreen, InfluencerNavigator | RELEASED | brand v78 / inf v67 / fol v41 | `a409c89` |
| 29 | Offer list + Offer detail | OfferListScreen, OfferDetailScreen | RELEASED | brand v79 / inf v68 / fol v42 | `7798494` |
| 30 | Negotiation + BrandProfile (StatusPill `mode='influencer'`) | NegotiationScreen, BrandProfileScreen | RELEASED | brand v80 / inf v69 / fol v43 | `8446373` |
| 31 | My Campaigns + Campaign detail (StatusPill +4) | MyCampaignsScreen, CampaignDetailScreen | RELEASED | brand v81 / inf v70 / fol v44 | `e971b38` |

### Flow 32 — IN-FLIGHT (3 screens, audit + mockup done, awaiting founder lock)

**Slug**: `redesign-flow-32-influencer-mobile-completion-store`
**Screens**: `CampaignCompletionScreen` (672 LOC) + `CampaignProductsScreen` (344 LOC) + `MyStoreScreen` (209 LOC) = 1,225 LOC
**SDK boundaries**: ZERO
**Backend compat**: ✓ — 6 APIs traced (getMyCampaignDetail / getCampaignCommissionDetail / getCampaignProducts / upsertProductNote / getProductNotes / deleteProductNote / getMyStorePreview)
**StatusPill additions**: ZERO (43-entry map unchanged)
**Mockup**: WRITTEN at `design/wave2/flow-32-influencer-mobile-completion-store/web.html`
**4 design calls already locked by founder**:
1. CampaignCompletion celebration header: **Ink with yellow check + yellow accent**
2. Total Earned highlight: **successPale + successText**
3. Category emoji fallback in product cards: **KEEP** (🍽️ 💇 🚗 🏍️ 👗 👕 🧁 💐 per `brand_category`)
4. Emoji in CTAs/alerts: **DROP** (clean Outfit-Black UPPERCASE CTAs; alerts without 🎉🚀🔥)

**Next steps once founder says `lock`**:
- `mkdir -p features/redesign-flow-32-influencer-mobile-completion-store/{04-preview/mockups,06-diff}`
- `cp design/wave2/flow-32-influencer-mobile-completion-store/web.html features/redesign-flow-32-influencer-mobile-completion-store/04-preview/mockups/web.html`
- Write 7 artifacts (lock.json + 01-spec + 02-workflow + 03-expected-outputs + 04-preview/workflow-prediction + 05-impact + 06-diff/notes)
- Implement 3 screens (full rewrites likely cleanest for MyStore + CampaignProducts since they use `s` style namespace; CampaignCompletion via targeted edits + replace_all due to 672 LOC)
- `cd /c/WORK/inflx-platform && git add ... && git commit -m "feat(redesign): Flow 32 — ..." && git push origin main`
- Web QA: dual-probe pre-warm + `pnpm qa` (expect 76/76 GREEN gate 0)
- `pnpm publish-ota:all -m "Flow 32 — ..."`
- Update lock.json `release.released=true` + populate deploy block with the 3 manifest hashes/versions
- `chore(release): Flow 32 — backfill deploy.commit = ...` close-out commit

### Remaining flows (33-37) — 5 flows · 13 screens

| # | Flow | Screens | LOC | Risk | Notes |
|---|---|---|---|---|---|
| 33 | Deliverable bundle | DeliverableList (470) · Deliverable (676) · DeliverableDetail (657) | ~1,803 | **HIGH** | `react-native-image-picker` (camera + library) SDK boundary in `DeliverableScreen` |
| 34 | Earnings + Commission + Transactions | Earnings (287) · CommissionDetail (310) · TransactionFeed (166) | ~763 | Low | Read-mostly money screens |
| 35 | Profile + InfluencerContracts + ContractPdf | Profile (675) · InfluencerContracts (168) · ContractPdf (148) | ~991 | Med | `react-native-webview` SDK in ContractPdf (small, simple) |
| 36 | Proposals hub + Send proposal | ProposalsHub (298) · SendProposal (245) | ~543 | Low | Outbound proposals — influencer-side analog of brand proposal inbox |
| 37 | **Contract (FINALE)** | ContractScreen (1534) | ~1,534 | **Critical** | Biggest screen in mobile codebase · DateTimeChipPicker restyle deferred from Flow 27 lands here · mirrors brand Flow 27 finale |

After Flow 37 ships → mobile-influencer bucket COMPLETE → next bucket = **follower mobile (44 screens)**.

---

## 6 · LOCKED PALETTE (every flow)

```
WHITE        #FFFFFF    surfaces (cards)
BG           #FAFAFA    page background
BG2          #F4F4F5    secondary surface (chip bg)
YELLOW       #FFC107    brand / CTAs / accents
YELLOW_HOVER #E0A800
YELLOW_PALE  #FFF7CC    badge bg, focus halo
YELLOW_50    #FFFDEB    gradient start
YELLOW_TEXT  #6B5A00    text on yellow-pale
INK          #0A0A0A    text + dark chrome (topbar/sticky)
INK_2        #1F1F22    secondary dark surfaces
MUTED        #52525B
MUTED_2      #71717A
MUTED_3      #A1A1AA
MUTED_4      #D4D4D8
BORDER       #E4E4E7
BORDER_SOFT  #F4F4F5

SUCCESS      #10B981    SUCCESS_PALE #D1FAE5  SUCCESS_TEXT #047857
DANGER       #E8401A    DANGER_PALE  #FDEEE9  DANGER_TEXT  #B91C1C
INFO         #1D4ED8    INFO_PALE    #DBEAFE
CONV         #7E22CE    CONV_PALE    #F3E8FF
HYB          #6B5A00    HYB_PALE     #FFF7CC
```

**Fonts** (consumed via `fonts.*` from `theme/tokens.js`):
- **Outfit** (`displayBold` / `displayBlack`) — display, H1, headings, buttons
- **Plus Jakarta Sans** (`sansRegular` / `sansMedium` / `sansSemiBold` / `sansBold`) — body
- **JetBrains Mono** (`monoMedium` / `monoBold`) — ALL digits/IDs/amounts/handles/dates/counts

**Logo policy**: dashed `[LOGO]` placeholder (or yellow ink-Outfit-Black initial tile for brand-specific surfaces).

---

## 7 · StatusPill canonical map (43 entries · `components/brand/StatusPill.js`)

Lives at `Packages/Mobile/src/components/brand/StatusPill.js`. Imports `brandPalette as P, fonts`.

```js
export const STATUS_MAP_DEFAULT = {
  // ─── new/pending-actionable (yellowPale + yellowText)
  new:                 { bg: P.yellowPale,  fg: P.yellowText,  label: 'NEW' },
  submitted:           { bg: P.yellowPale,  fg: P.yellowText,  label: 'NEW' },
  sent:                { bg: P.yellowPale,  fg: P.yellowText,  label: 'NEW' },
  applied:             { bg: P.yellowPale,  fg: P.yellowText,  label: 'APPLIED' },
  negotiating:         { bg: P.yellowPale,  fg: P.yellowText,  label: 'NEGOTIATING' },
  pending:             { bg: P.bg2,         fg: P.muted2,      label: 'PENDING' },
                                                                // mode='transaction' overrides to yellowPale/yellowText

  // ─── viewed/responded/contacted (infoPale + info)
  contacted:           { bg: P.infoPale,    fg: P.info,        label: 'CONTACTED' },
  viewed:              { bg: P.infoPale,    fg: P.info,        label: 'VIEWED' },
  responded:           { bg: P.infoPale,    fg: P.info,        label: 'RESPONDED' },

  // ─── counter/negotiation (convPale + conv)
  countered:           { bg: P.convPale,    fg: P.conv,        label: 'COUNTERED' },

  // ─── success/positive (successPale + successText)
  converted:           { bg: P.successPale, fg: P.successText, label: 'CONVERTED' },
  accepted:            { bg: P.successPale, fg: P.successText, label: 'ACCEPTED' },
  contracted:          { bg: P.successPale, fg: P.successText, label: 'CONTRACTED' },
  active:              { bg: P.successPale, fg: P.successText, label: 'ACTIVE' },
  completed:           { bg: P.successPale, fg: P.successText, label: 'COMPLETED' },
  live:                { bg: P.successPale, fg: P.successText, label: 'LIVE' },

  // ─── negative/terminal (dangerPale + dangerText)
  rejected:            { bg: P.dangerPale,  fg: P.dangerText,  label: 'REJECTED' },
  rejected_by_brand:   { bg: P.dangerPale,  fg: P.dangerText,  label: 'REJECTED' },
  declined:            { bg: P.dangerPale,  fg: P.dangerText,  label: 'DECLINED' },
  cancelled:           { bg: P.dangerPale,  fg: P.dangerText,  label: 'CANCELLED' },

  // ─── terminal-grey (bg2 + muted2)
  invited:             { bg: P.bg2,         fg: P.muted2,      label: 'INVITED' },
  closed:              { bg: P.bg2,         fg: P.muted2,      label: 'CLOSED' },
  expired:             { bg: P.bg2,         fg: P.muted2,      label: 'EXPIRED' },
  withdrawn:           { bg: P.bg2,         fg: P.muted2,      label: 'WITHDRAWN' },
  refunded:            { bg: P.bg2,         fg: P.muted2,      label: 'REFUNDED' },
  slots_filled:        { bg: P.bg2,         fg: P.muted2,      label: 'SLOTS FILLED' },
  walked_away:         { bg: P.bg2,         fg: P.muted2,      label: 'CLOSED' },

  // ─── Negotiation in-flight (Flow 23)
  awaiting_brand:      { bg: P.yellowPale,  fg: P.yellowText,  label: 'YOUR TURN' },
  awaiting_influencer: { bg: P.infoPale,    fg: P.info,        label: 'WAITING' },
  agreed:              { bg: P.successPale, fg: P.successText, label: 'AGREED' },
  open:                { bg: P.yellowPale,  fg: P.yellowText,  label: 'OPEN' },

  // ─── Contract lifecycle (Flow 25)
  draft:               { bg: P.bg2,         fg: P.muted2,      label: 'DRAFT' },
  pending_influencer:  { bg: P.yellowPale,  fg: P.yellowText,  label: 'AWAITING INFLUENCER' },
  pending_brand:       { bg: P.yellowPale,  fg: P.yellowText,  label: 'YOUR TURN' },

  // ─── Production-event lifecycle (Flow 27)
  proposed:            { bg: P.yellowPale,  fg: P.yellowText,  label: 'PROPOSED' },
  confirmed:           { bg: P.successPale, fg: P.successText, label: 'CONFIRMED' },
  in_progress:         { bg: P.infoPale,    fg: P.info,        label: 'IN PROGRESS' },

  // ─── Withdrawal lifecycle (Flow 28)
  processing:          { bg: P.infoPale,    fg: P.info,        label: 'PROCESSING' },
  failed:              { bg: P.dangerPale,  fg: P.dangerText,  label: 'FAILED' },

  // ─── Campaign + deliverable + tranche (Flow 31)
  published:           { bg: P.infoPale,    fg: P.info,        label: 'PUBLISHED' },
  revision_requested:  { bg: P.yellowPale,  fg: P.yellowText,  label: 'REVISION' },
  locked:              { bg: P.bg2,         fg: P.muted2,      label: 'LOCKED' },
  released:            { bg: P.successPale, fg: P.successText, label: 'RELEASED' },
};
```

**Two `mode` overrides** (must check BEFORE label resolution):
- `mode='transaction'` (Flow 21) → `pending` flips to yellowPale/yellowText/'PENDING'
- `mode='influencer'` (Flow 30) → `awaiting_brand` flips to infoPale/info/'WAITING'; `awaiting_influencer` flips to yellowPale/yellowText/'YOUR TURN'

---

## 8 · NATIVE REBUILD STATE — `NATIVE_RUNTIME = '2'`

Set in `Packages/Mobile/src/services/otaUpdater.js` line 28.

**APKs built + installed on emulator-5554 (Pixel_6 AVD)** during Flow 28:
- `Packages/Mobile/android/app/build/outputs/apk/brand/release/app-brand-release.apk` (27MB, May 26 09:42)
- `Packages/Mobile/android/app/build/outputs/apk/influencer/release/app-influencer-release.apk` (27MB, May 26 09:47)
- `Packages/Mobile/android/app/build/outputs/apk/follower/release/app-follower-release.apk` (27MB, May 26 09:47)

Each APK bundles `MaterialCommunityIcons.ttf` (1.1MB) via the `apply from: vector-icons fonts.gradle` line in `android/app/build.gradle`. Confirmed via `unzip -l` showing `assets/fonts/MaterialCommunityIcons.ttf`.

**Founder's physical phone may still be on the old APK (NATIVE_RUNTIME=1).** If so, the influencer app on phone won't pick up any Flow 28+ OTA bundles (runtime mismatch → falls back to baked-in JS, no crash). Founder needs to install `app-influencer-release.apk` to see Flow 28-32 changes.

**For Flows 33-37**: NO additional native rebuild needed — pure JS via OTA.

---

## 9 · MAESTRO SETUP (4/4 baseline green)

Emulator-5554 (Pixel_6 AVD) — already running with 3 APKs installed.

`pnpm qa:maestro:doctor` → must report ALL GREEN before `pnpm qa:maestro` runs.

**Current Maestro flows** at `qa/maestro/flows/`:
- `00-smoke.yaml` — follower APK boot + screenshot
- `01-follower-public-browse.yaml` — anonymous feed render
- `02-influencer-launch.yaml` — influencer APK boot + auth screen render (`assertVisible: "Welcome back"` + `"Influencer app"` + `"Send OTP"`)
- `03-brand-launch.yaml` — brand APK boot + auth screen render

**Deferred** at `qa/maestro/flows/_deferred/`:
- `04-influencer-flow-28-auth-onboarding.yaml` — drives phone→OTP→onboarding but post-onboarding routes to "Profile recognised" admin-verify gate that blocks Home; needs pre-verified test account to reach Home

**Per-flow QA strategy**:
- Web `pnpm qa` is the primary gate (76/76 GREEN gate 0 first-run target)
- Maestro 4/4 baseline applies; new screens NOT individually Maestro-verified — covered by founder physical smoke-test on installed APK
- Each close-out uses `GOVERNANCE_OVERRIDE="Maestro 4/4 baseline applies; deep [screen] visual verification deferred per maestro-influencer-coverage open question (admin-verify gate blocks Home); founder physical smoke-test on installed APK covers visual upgrade"`

---

## 10 · DEPLOY CADENCE (the locked rhythm)

**Every flow:**

1. **`git push origin main`** with feat commit → triggers Vercel auto-deploy brand-web + admin-web (no-op for mobile-only changes) + Render auto-deploy backend (no-op).
2. **`pnpm qa`** (after dual-probe pre-warm) → must be 76/76 GREEN gate 0.
3. **`pnpm publish-ota:all`** with `-m "Flow N — ..."` message → single Node process pushes to brand/influencer/follower R2 bundles. Output prints versions.
4. **Curl manifest endpoints** for each flavor to get `bundle_hash` + `published_at` for the close-out lock.json deploy block.
5. **Update lock.json** to flip `status: 'released'`, `release.qa_all_green: true`, `release.released: true`, `release.released_by/at`, `release.deploy.*` with the 3 OTA blocks.
6. **`git push`** the close-out commit (deploy-inert).

### Dual-probe pre-warm (mandatory before pnpm qa)

```bash
cd /c/WORK/inflx-platform && powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force"
sleep 3
curl -s --max-time 60 "https://inflx-platform.onrender.com/v1/ota/manifest?flavor=influencer&runtime=2" | head -c 80
curl -s --max-time 30 "https://inflx-platform.onrender.com/v1/admin/stats" | head -c 80
curl -s -X POST --max-time 30 "https://inflx-platform.onrender.com/v1/auth/refresh" | head -c 80
pnpm qa
```

Adds ~50s overhead on cold backend but ELIMINATES env-flake clusters that caused 4 pending-cert flows in the prior bucket.

---

## 11 · GOV-CHECK RULES (5 rules — `qa/scripts/governance-check.mjs`)

Pre-push hook + CI runs gov-check on every push.

- **Rule 1**: governed-path code requires approved contract + complete (01-spec.md / 02-workflow.md / 05-impact.md) files
- **Rule 2**: `release.released=true` requires populated `release.deploy` block (NOT `release.deploy_evidence` — schema gotcha)
- **Rule 3** (UI-governed): `mockup_locked=true` required when touching `Packages/*/(src|app|components|lib|screens|services)/`
- **Rule 4** (UI-governed): `06-diff/notes.md` present + non-empty
- **Rule 5** (Mobile-governed): `release.maestro_green=true` required when flipping `released=true` on commit touching `Packages/Mobile/src/**`

`GOVERNANCE_OVERRIDE="reason"` env var on push bypasses with a loud, recorded notice. Used per close-out for Rule 5.

---

## 12 · CONTRACT FOLDER TEMPLATE (7 artifacts)

For Flow 32 (about to be created):

```
features/redesign-flow-32-influencer-mobile-completion-store/
├── 01-spec.md              # problem/goal/scope/data
├── 02-workflow.md          # actor + preconditions + steps + success + edge (REQUIRED by gov-check Rule 1)
├── 03-expected-outputs.md  # per-state outputs + data assertions + visual evidence
├── 04-preview/
│   ├── mockups/web.html    # mirror of design/wave2/<slug>/web.html
│   └── workflow-prediction.md  # tile → backend source mapping
├── 05-impact.md            # files / APIs / regression / mobile-risks / time (REQUIRED by gov-check Rule 1)
├── 06-diff/notes.md        # before/after (populated AFTER implementation, REQUIRED by gov-check Rule 4)
└── lock.json               # state machine — approved/mockup_locked/released
```

**lock.json at impl-ready state**:

```json
{
  "feature": "redesign-flow-N-<slug>",
  "spec_version": "1.0.0",
  "status": "locked",
  "approved": true,
  "approved_by": "founder · YYYY-MM-DD chat \"...\"",
  "approved_at": "YYYY-MM-DD",
  "preview_reviewed": true,
  "impact_reviewed": true,
  "mockup_locked": true,
  "mockup_locked_by": "founder · YYYY-MM-DD chat — Flow N mockup locked",
  "mockup_locked_at": "YYYY-MM-DD",
  "notes": "...",
  "release": {
    "qa_all_green": false,
    "qa_evidence": null,
    "released": false,
    "released_by": null,
    "released_at": null,
    "deploy_class": "production-impacting",
    "deploy_targets": ["ota:brand", "ota:influencer", "ota:follower"],
    "native_rebuild_required": false,
    "native_rebuild_note": "Flow 28 laid the MCI font foundation. Flow N = pure JS OTA.",
    "maestro_green": "n/a until release-flip; will use GOVERNANCE_OVERRIDE='Maestro 4/4 baseline applies; deep [screens] visual verification deferred per maestro-influencer-coverage open question (admin-verify gate blocks Home); founder physical smoke-test on installed APK covers visual upgrade'"
  }
}
```

**lock.json at clean GREEN release** — see `features/redesign-flow-31-influencer-mobile-campaigns/lock.json` as the latest worked example.

---

## 13 · FLOW 32 EXACT NEXT STEPS

The mockup at `design/wave2/flow-32-influencer-mobile-completion-store/web.html` is ready. Founder hasn't said `lock` yet. **DO NOT execute until they do.**

After founder confirms `lock`:

```bash
# 1. Mirror mockup + create artifact dirs
cd /c/WORK/inflx-platform && \
  mkdir -p features/redesign-flow-32-influencer-mobile-completion-store/04-preview/mockups && \
  mkdir -p features/redesign-flow-32-influencer-mobile-completion-store/06-diff && \
  cp design/wave2/flow-32-influencer-mobile-completion-store/web.html \
     features/redesign-flow-32-influencer-mobile-completion-store/04-preview/mockups/web.html
```

**2. Write 7 artifacts** in parallel — use Flow 31 contract folder as template (same structure, swap names/specifics).

**3. Implement 3 screens** (recommended approach):

- **MyStoreScreen (209 LOC)**: full Write rewrite — uses `s` style namespace + `spacing`/`radius` imports; cleaner to rewrite than swap.
- **CampaignProductsScreen (344 LOC)**: full Write rewrite — same `s` namespace pattern + 4-API publish flow to preserve verbatim.
- **CampaignCompletionScreen (672 LOC)**: targeted edits + replace_all token swaps (similar approach to Flow 31's CampaignDetailScreen which was 1,176 LOC).

**Token swap mappings** (apply via batched `replace_all`, longer prefix first to avoid collisions):
- `colors.border2` → `P.muted4`
- `colors.navyDeep` → `P.ink`
- `colors.navyPale` → `P.yellowPale` (note: secondaryBtn in CampaignCompletion uses navyPale; mockup wants ghost-ink so update text color separately)
- `colors.tealDeep` → `P.successText`
- `colors.tealPale` → `P.successPale`
- `colors.goldPale` → `P.yellowPale` (or `P.successPale` for the total-earned highlight per locked design call #2)
- `colors.orangePale` → `P.yellowPale` (note: Live badge in Products uses tealPale not orangePale, already maps cleanly)
- `colors.orangeDeep` → `P.yellowText`
- `colors.surface2` → `P.bg2`
- `colors.t1` → `P.ink`
- `colors.t2` → `P.muted`
- `colors.t3` → `P.muted2`
- `colors.border` → `P.border`
- `colors.navy` → `P.ink`
- `colors.teal` → `P.success`
- `colors.gold` → `P.yellow`
- `colors.orange` → `P.yellow` (CampaignProducts publish button bg = orange; mockup wants ink — handle inline)
- `colors.red` → `P.danger`
- `colors.bg` → `P.bg`
- `colors.white` → `P.white`

**Custom hex literals to swap manually (after bulk)**:
- `#7A5500` → `P.yellowText`
- `#5A4000` → `P.ink` (the Total Earned value text — but design call #2 says successText so use that)
- `#F0D060` → drop or use `P.yellow`
- `#92400e` → `P.yellowText`
- `#b45309` → `P.muted`
- `#fde68a` → `'#F0DA88'` (yellow border on yellowPale bg)

**Drop**: `import StatusBadge from '../../components/StatusBadge'` (only CampaignCompletion has it).

**Add `import Icon from 'react-native-vector-icons/MaterialCommunityIcons'`** to CampaignCompletion (for check-bold MCI in celebration tile + back chevron).

**Per locked design call #4**: Drop emoji from these copy strings:
- `Alert.alert('Published! 🎉', ...)` → `Alert.alert('Published', ...)`
- `🚀 Publish to My Store` → `PUBLISH TO MY STORE`
- `Check out this amazing ${product.name}! Great deal 🔥` → `Check out this amazing ${product.name}! Great deal.`

**Per locked design call #3**: KEEP the `CATEGORY_EMOJI` constant verbatim in both Products + Store (8 entries).

**4. Stage + commit + push feat**:

```bash
cd /c/WORK/inflx-platform && \
  git add Packages/Mobile/src/screens/influencer/CampaignCompletionScreen.js \
          Packages/Mobile/src/screens/influencer/CampaignProductsScreen.js \
          Packages/Mobile/src/screens/influencer/MyStoreScreen.js \
          features/redesign-flow-32-influencer-mobile-completion-store/ \
          design/wave2/flow-32-influencer-mobile-completion-store/ && \
  git commit -m "feat(redesign): Flow 32 — ..." && \
  git push origin main
```

**5. Web QA (dual-probe pre-warm + pnpm qa)** — expect 76/76 GREEN gate 0 first-run.

**6. `pnpm publish-ota:all -m "Flow 32 — ..."`** — expect brand v82 / influencer v71 / follower v45 (versions increment by 1 from Flow 31's 81/70/44).

**7. Fetch manifests** for the 3 hashes + write the close-out lock.json with full deploy block. Commit + push close-out (`chore(release): Flow 32 — backfill deploy.commit = ...`).

---

## 14 · NO-TOUCH LIST

**Window A territory**:
- `backend/**`, `backend/migrations/**` — entire backend
- `Packages/shared/api/**` — shared API client
- Settings hub layout, subscription/billing pages — Window A entitlements work
- Any admin pages

**System stability**:
- API call shapes (frozen contracts)
- Form field names (Razorpay, OTP, etc.)
- Route names (URL strings)
- AsyncStorage keys (`inflx_token` etc.)
- Role-routing branches (brand vs influencer vs follower vs admin)
- `Packages/Mobile/src/config/api.js` — committed empty; local edits via `git update-index --skip-worktree`
- `Packages/brand-web/app/dashboard/products/components/**` — listing engine spine

**Wave-3 follower screens consuming `lightColors`** (24 files — additive `brandPalette` exports only, never modify existing):
- All `Packages/Mobile/src/screens/follower/Meals*`, `Restaurant*`, `Dining*`, `BookingConfirmed*`, `InfluencerStore*`, `FollowerWallet*`
- All `Packages/Mobile/src/components/restaurant/*`
- `Packages/Mobile/src/components/Location*`

**Already-shipped influencer screens** (don't re-touch unless intentional Adjacent-fix):
- HomeScreen, NotificationsScreen, InfluencerNavigator (Flow 28)
- OfferListScreen, OfferDetailScreen (Flow 29)
- NegotiationScreen, BrandProfileScreen (Flow 30)
- MyCampaignsScreen, CampaignDetailScreen (Flow 31)

**Process**:
- Never commit credentials (.env, etc.)
- Never `--force-push`, never `--no-verify`, never amend pushed commits
- Production-impacting deploys ALWAYS surfaced for explicit go
- `GOVERNANCE_OVERRIDE` for Rule 5 bypass = loud + recorded, never silent

---

## 15 · KEY PATTERNS LEARNED (Flows 28-31)

### 15.1 · Token swap order matters

When doing bulk `replace_all` token swaps, **longer prefixes first** to avoid collisions:
- Do `colors.border2` BEFORE `colors.border`
- Do `colors.navyDeep` + `colors.navyPale` BEFORE `colors.navy`
- Do `colors.tealDeep` + `colors.tealPale` BEFORE `colors.teal`
- Do `colors.orangeDeep` + `colors.orangePale` BEFORE `colors.orange`

### 15.2 · CampaignCompletion stylistic overrides after bulk swap

After bulk replace_all:
- Celebration header `colors.tealDeep` bg → `P.successText` from bulk, but locked design call #1 says **P.ink**. Override.
- `totalEarnedBox` `colors.goldPale` bg → `P.yellowPale` from bulk, but locked call #2 says **P.successPale**. Override.
- Tranche dots use `colors.teal/colors.orange` inline → success/yellow after bulk. ✓
- Timeline highlight uses `colors.gold` bg → `P.yellow` after bulk. Update to ink-bordered yellow (per Flow 31 progress current).
- Type badges use `colors.navyPale` bg + `colors.navy` text → yellowPale + ink after bulk. ✓

### 15.3 · CampaignProducts publish button

`colors.orange` bg + `'#fff'` text → after bulk becomes `P.yellow` bg + white text. Per locked design call #4 ("DROP emoji + clean Outfit-Black CTAs"), this should be **`P.ink` bg + `P.yellow` text + Outfit-Black UPPERCASE**. Override inline.

### 15.4 · Style namespace inconsistency

- CampaignCompletion uses `styles`
- CampaignProducts + MyStore use `s` (shorter)

Keep as-is for minimal diff. Both are valid JS variable names.

### 15.5 · Dual-probe is mandatory

Every web `pnpm qa` MUST be preceded by the 3-curl dual-probe (OTA manifest + admin/stats + auth/refresh). Without it, ~50% of first runs hit cold-start flakes that classify as env, not regression. With it, every flow has shipped 76/76 GREEN first run.

### 15.6 · OTA bundle hash & version increment pattern

Each `publish-ota:all` increments versions by 1 per flavor:
- brand: 78 (F28) → 79 (F29) → 80 (F30) → 81 (F31) → expects 82 (F32)
- influencer: 67 → 68 → 69 → 70 → expects 71
- follower: 41 → 42 → 43 → 44 → expects 45

All 3 flavors share the same bundle (same hash). Different `published_at` timestamps (sequential upload, ~5-10s apart).

### 15.7 · Cold-start handling on `node -e` JSON parse helper

For manifest hash extraction, use:
```bash
curl -s --max-time 30 "https://inflx-platform.onrender.com/v1/ota/manifest?flavor=influencer&runtime=2" | \
  node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{const m=JSON.parse(d).data.manifest; console.log(JSON.stringify({v:m.version,h:m.bundle_hash,at:m.published_at,kb:m.bundle_size_kb}))})"
```

Do NOT pipe to `python` (Windows aliases python to Microsoft Store launcher; fails with exit 49).

---

## 16 · KNOWN GOTCHAS

### 16.1 · Cwd persistence between Bash calls

UNRELIABLE. Always prefix with `cd /c/WORK/inflx-platform &&`. Especially after `run_in_background` tasks return — cwd often resets to `/c/WORK/`.

### 16.2 · `&` and `⏳` escape literals in source

Some older JS files have literal `&` (the 6-char string) instead of `&`. The Edit tool's auto-swap fails on these. Workaround: target a smaller chunk that doesn't include the escape line, OR include the literal `&` text in your old_string.

### 16.3 · Write tool safety check

Write requires a prior Read on the same file (even for files you authored earlier in the session). If you get "File has not been read yet" — Read first (any tiny chunk works as a token), then retry Write.

### 16.4 · Background task notifications

When you launch a `run_in_background` Bash command, you'll get a `<task-notification>` when it completes. Do NOT poll the output file before that — let it notify. The notification confirms exit code but you still need to Read the output file to see actual stdout.

### 16.5 · `pnpm qa` exit code via tail pipeline

The pattern `pnpm qa 2>&1 | tail -8` always exits 0 even on failure (tail's exit, not pnpm's). To check QA result, parse the tail output for "STATE=GREEN" + "gate 0".

### 16.6 · Vector-icons font path

Already wired in Flow 28: `Packages/Mobile/android/app/build.gradle` has the `apply from: vector-icons/fonts.gradle` line + `project.ext.vectoricons.iconFontNames=['MaterialCommunityIcons.ttf']` config. **Do not modify.**

### 16.7 · LF/CRLF warnings on git add

Windows Git emits "LF will be replaced by CRLF" warnings on every staged file. Harmless. Git's autocrlf handles correctly.

### 16.8 · CampaignProducts `is_published` flag

Drives 3 render branches per product card. NOT a status pill — keep as-is logic, just update the inline "Live" badge styling.

### 16.9 · Founder confirms via short replies

Typical lock confirmations: "lock", "pls lock and continue", "ok proceed", "pls proceed". All mean: go execute. NOT "approve" or "yes".

---

## 17 · MEMORY FILES (auto-memory at `C:\Users\aveen\.claude\projects\C--WORK\memory\`)

Index in `MEMORY.md`:
- `user_role.md` — solo/small-team founder on INFLX
- `project_inflx_overview.md` — 3-sided platform
- `reference_inflx_docs.md` — pointers to CLAUDE.md, contracts-v1.md, OTA_WORKFLOW.md
- `feedback_verify_twice.md` — read actual file before claiming route/column/endpoint exists
- `feedback_adjacent_fix.md` — fix small in-scope bugs silently when already in the file
- `feedback_stage_discipline.md` — System A (feature) + System B (reliability) pipelines
- `project_governance_roadmap.md` — founder's 8-item roadmap
- `feedback_comms_cadence.md` — state when-starting before any pause; state what-done + what-next after every phase
- `feedback_deploy_cadence.md` — migrate → commit → push → OTA; ask before deploying
- `feedback_ota_publish_strategy.md` — single `publish-ota:all` + dual-probe pre-warm
- `feedback_csv_first_seeds.md` — CSV before SQL migration
- `feedback_redesign_flow_discussion.md` — every flow gets scope+impact+expected-outcome discussion
- `feedback_impact_terse.md` — chat impact = one-line verdict
- `feedback_redesign_5step_rhythm.md` — locked 5-step rhythm
- `feedback_redesign_app_sequence.md` — brand-web → mobile brand → mobile influencer → follower mobile
- `feedback_backend_first_tiles.md` — every tile must trace to a real backend field
- `feedback_admin_role_gates.md` — INFLX admin endpoints default to requireAnyAdminRole
- `reference_qa_foundation.md` — qa/+features/ contract-driven QA
- `feedback_qa_governance.md` — never auto-trust tests; classify every failure
- `project_pnpm_workspace_casing.md` — `Packages/*` real dir, `packages/*` glob bug

---

## 18 · TASK LIST STATE AT WINDOW HANDOFF

When you start the new window, the task list will be empty. Create fresh tasks for Flow 32:
- Inventory: audit done in this window — skip
- Risk + design: done — skip
- Mockup: done — skip
- **Mirror + artifacts + implement + QA + ship** — this is the next active task
- Then Flow 33 / 34 / 35 / 36 / 37 sequence per §5

---

## 19 · COMMUNICATION CADENCE (carried)

Founder rule: before any pause/rest/break, state when-starting + what-you'll-do. After every phase/break/pause, report what-done + what-next in plain functional language.

**Standing autonomy**: deploy-inert work proceeds without asking. Production-impacting (push / OTA) gets explicit go. "Take best action" = delegated, stop re-asking.

---

# APPENDIX · COMMITS SHIPPED IN THIS WINDOW (mobile-influencer bucket)

```
e971b38 chore(release): Flow 31 — backfill deploy.commit = 3f402ee (OTA brand v81 + influencer v70 + follower v44)
3f402ee feat(redesign): Flow 31 — influencer-mobile My Campaigns + Campaign Detail
8446373 chore(release): Flow 30 — backfill deploy.commit = 90b9ab4 (OTA brand v80 + influencer v69 + follower v43)
7a28438 [Window A?]
90b9ab4 feat(redesign): Flow 30 — influencer-mobile Negotiation + BrandProfile
8c7163e [Window A?]
7798494 chore(release): Flow 29 — backfill deploy.commit = 8a9fcb6 (OTA brand v79 + influencer v68 + follower v42)
8a9fcb6 feat(redesign): Flow 29 — influencer-mobile Offer list + Offer detail
22d4ed2 [Window A?]
c409eb9 chore(release): Flow 28 — backfill deploy.commit = 0171970 (OTA brand v78 + influencer v67 + follower v41, NATIVE_RUNTIME=2)
efdde70 test(maestro): Flow 28 — launch flows + auth-onboarding deferred
0171970 feat(redesign): Flow 28 — influencer-mobile Home + Notifications + Navigator (REDESIGNED + real MCI icons + native rebuild)
1bf3c68 docs(handoff): mobile-brand bucket v1 handoff for Flow 27 (prior session entry point)
```

Plus 4 retroactive certs from earlier in this session: Flow 19, 21, 23, 25 (mobile-brand bucket pending-cert cleanup).

---

# END OF HANDOFF v1 (mobile-influencer bucket · Flow 32 prep)

**Recap of immediate next actions** (also at top §3):

1. `cd /c/WORK/inflx-platform && git log --oneline -10 && git status --short` → confirm HEAD = `e971b38`
2. Read GOVERNANCE.md + CLAUDE.md + Docs/OTA_WORKFLOW.md + LOCAL.md (parallel)
3. Read this handoff
4. Surface to founder: "Resumed Flow 32 from handoff. HEAD = e971b38. Flow 32 mockup ready at `design/wave2/flow-32-influencer-mobile-completion-store/web.html` — awaiting your `lock` confirmation."
5. **Wait** for founder's `lock` reply before executing
6. Once locked: execute the 7-step shipping pipeline per §13

**The mobile-influencer bucket is 4/23 shipped. 19 screens / 6 flows remain. You have everything you need.**

Pick up exactly where Window B left off at HEAD = `e971b38` with Flow 32 mockup ready.
