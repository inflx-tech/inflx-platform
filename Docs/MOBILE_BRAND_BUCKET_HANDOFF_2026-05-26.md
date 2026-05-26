# INFLX mobile-brand bucket — handoff for Flow 27 window (v1 · 2026-05-26)

> **Drop this entire file as the first prompt in the new window.** OR have it Read the file directly via `Read C:\WORK\inflx-platform\Docs\MOBILE_BRAND_BUCKET_HANDOFF_2026-05-26.md`. Contains: full state, ALL rules from v3 + locked palette, brandPalette + 3 components + StatusPill 34-entry map fully inlined, 9 shipped flows (18-26) with commits/OTA versions, Flow 27 detailed plan, NO-TOUCH, pre-warm QA discipline, pending-cert certify path, all memory references. Engineered so the new window picks up cold without losing context.

---

## 0 · ONE-LINE STATE

**Mobile-brand bucket 15/16 shipped (Flows 18-26 live). `origin/main` HEAD = `df68ce2`. `pnpm qa` baseline = 76/76 GREEN gate 0 (with dual-probe warm-up). Next = Flow 27 = BrandContractScreen (1341 LOC · critical-risk finale): signature pad + PDF + production lifecycle. Bucket completion after Flow 27 → next bucket = mobile influencer (23 screens).**

---

## 1 · IDENTITY

You are **Window B continued** in INFLX's parallel two-window engineering setup. Founder = solo dev on `C:\WORK\inflx-platform\` (aveenswamy1989@gmail.com). Chat-architect / Code-builder orchestration. Prod-as-staging (no staging env).

**This window (you)** — UI/UX redesign rollout. Previous session shipped 9 mobile-brand flows (18-26) in one go. Picking up at Flow 27 (final screen in the mobile-brand bucket).

**Window A (parallel)** — Revenue model implementation. Most recent tracked pushes this session:
- `1004872` Phase A10 — feature catalog + tier_features + subscription_prices + admin tier editor (M061)
- `1ac4cd0` A10.5 — fix missing tier admin routes
- `07b0acd` A11 — brand subscription Monthly/Yearly toggle + entitlement render
- `38b841a` A12.1 — migrate quota gates from legacy columns to entitlements (M062)
- `f1cd4a3` A12.1.5 — quota preflight on entry buttons

Window A is actively iterating on subscriptions/entitlements. They may have pushed more since `df68ce2`.

## 2 · WORKING DIRECTORY (CRITICAL GOTCHA)

The Bash tool's cwd is `C:\WORK\` — NOT the repo. Every git/pnpm command must prefix with:

```bash
cd /c/WORK/inflx-platform && <your command>
```

Read/Write/Edit/Glob/Grep tools use absolute paths and work fine with `C:\WORK\inflx-platform\...`.

**Cwd persistence is UNRELIABLE** — sometimes inherits from prior `cd`, sometimes resets between Bash calls (especially after run_in_background tasks return). **Always prefix critical commands with `cd /c/WORK/inflx-platform &&`**. Lost ~6 retry cycles in the prior session ignoring this.

PowerShell is also available; Git Bash is the tested path for git/pnpm.

## 3 · FIRST 6 ACTIONS FOR NEW WINDOW

```bash
# 1. Confirm repo state — expect HEAD = df68ce2 (Flow 26 close-out)
cd /c/WORK/inflx-platform && git log --oneline -12 && git status --short
```

Expected: HEAD = `df68ce2 chore(release): Flow 26 — backfill deploy.commit = 5c75a00 (OTA brand v76 + influencer v65 + follower v39)` · clean working tree except prior session's untracked dirs.

2. **Read top entries** of `C:\Users\aveen\.claude\projects\C--WORK\memory\project_governance_roadmap.md` — live state. Flows 18-26 expected at top.

3. **Read** `C:\WORK\inflx-platform\CLAUDE.md` + `GOVERNANCE.md` + `LOCAL.md` + `Docs\OTA_WORKFLOW.md` (this last is critical for OTA × 3 ceremony).

4. **Read this whole handoff file** (you may already have it as context). Especially §17 (Flow 27 plan).

5. **Dual-probe pre-warm QA baseline** (new discipline since v3 handoff):
   ```bash
   cd /c/WORK/inflx-platform && powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force"
   sleep 3
   curl -s --max-time 60 "https://inflx-platform.onrender.com/v1/ota/manifest?flavor=brand&runtime=1"
   curl -s --max-time 30 "https://inflx-platform.onrender.com/v1/admin/stats"
   curl -s -X POST --max-time 30 "https://inflx-platform.onrender.com/v1/auth/refresh"
   pnpm qa 2>&1 | tail -10
   ```
   Expect: 76 passed gate 0 STATE=GREEN. If not, classify per §14.

6. **Tell the founder**: "Resumed from Flow 27 handoff. HEAD = df68ce2. Bucket 15/16. QA 76/76 GREEN. Want me to audit BrandContractScreen (1341 LOC) and propose a Flow 27 scope first, or dive straight into the mockup?"

---

## 4 · THE LOCKED 5-STEP RHYTHM (every flow, no exceptions)

Locked by founder 2026-05-23. Non-negotiable per-flow pipeline:

1. **Select flow** — agent proposes; founder confirms or redirects.
2. **Agree on look + UX** — build HTML mockup at `design/wave2/<flow-slug>/web.html` + mirror under `features/<slug>/04-preview/mockups/web.html`. **For mobile flows**, mockup is HTML rendered at phone-frame width (375px).
3. **Impact verdict (TERSE — one line in chat)** — `"zero functional / backend / logic / DB impact — visual + UX only."` Full mechanics live in `features/<slug>/05-impact.md`.
4. **Implement** — code change against locked mockups; preserve all NO-TOUCH; run `pnpm qa` for 76/76 GREEN (dual-probe pre-warm first).
5. **Deploy** — **Mobile flow: `pnpm publish-ota:all` (single Node process, 3 audit registrations per `feedback_ota_publish_strategy`). Close-out commit flips `lock.json release.released=true`.

**Standing autonomy**: deploy-inert work + design/lock decisions don't need permission. Production-impacting (OTA/Render/Vercel) DOES get explicit go.

**gov-check schema gotcha**: lock.json wants `release.deploy` NOT `release.deploy_evidence`. Mobile flows ALSO need `release.maestro_green: true` (Rule 5) when flipping `released=true` if any `Packages/Mobile/src/**` is touched. If skipping Maestro, use `GOVERNANCE_OVERRIDE="reason"` env var on the push — loud, never silent.

**Backend-first tile rule** (founder 2026-05-23): every visible metric in a mockup must trace to a real backend field TODAY. Grep `backend/src/controllers/` before publishing the mockup. Phantom fields = drop them.

**gov-check Rule 1 also requires contract completeness** (lesson from Flow 23): the lock.json's contract directory must contain `01-spec.md`, `02-workflow.md`, AND `05-impact.md`. Skipping 02 / 03 / 04-preview/workflow-prediction blocks the push. **Always write ALL of**: lock.json, 01-spec, 02-workflow, 03-expected-outputs (optional but safer), 05-impact, 04-preview/mockups/web.html, 06-diff/notes.md.

## 5 · THE LOCKED APP SEQUENCE (updated 2026-05-26)

**Order — do NOT interleave:**

1. ~~brand-web COMPLETE~~ ← 2026-05-25 (Flows 1-17)
2. **mobile brand 15/16 ← CURRENT** (Flow 27 = final = BrandContractScreen)
3. mobile influencer (23 screens · NEXT BUCKET)
4. follower mobile (44 screens)

**Admin web (`/admin/**`)** = deferred until founder explicitly schedules.

**After Flow 27 ships**, surface bucket COMPLETE status and propose mobile-influencer audit (23 screens to map).

---

## 6 · LOCKED PALETTE (8 hexes + extensions, every flow)

```
WHITE        #FFFFFF    surfaces (cards)
BG           #FAFAFA    page background
BG2          #F4F4F5    secondary surface (chip bg, ks)
YELLOW       #FFC107    brand / CTAs / accents
YELLOW_HOVER #E0A800
YELLOW_PALE  #FFF7CC    badge bg, focus halo
YELLOW_50    #FFFDEB    very pale (gradient start)
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
CONV         #7E22CE    CONV_PALE    #F3E8FF
ENG          #0E7490    ENG_PALE     #CFFAFE
HYB          #6B5A00    HYB_PALE     #FFF7CC
INFO         #1D4ED8    INFO_PALE    #DBEAFE
```

**Fonts (consumed via `fonts.*` exports from `theme/tokens.js`)**:
- **Outfit** (`displayBold` / `displayBlack`) — display (H1, headings, buttons)
- **Plus Jakarta Sans** (`sansRegular` / `sansMedium` / `sansSemiBold` / `sansBold`) — body
- **JetBrains Mono** (`monoMedium` / `monoBold`) — ALL digits/IDs/amounts/handles/dates/counts

**Logo policy**: dashed `[LOGO]` placeholder. Founder uploads asset later.

---

## 7 · `brandPalette` EXPORT (already in `Packages/Mobile/src/theme/tokens.js`)

Added in Flow 18. **Do not modify** existing brandPalette keys. Future flows extend additively only.

```js
export const brandPalette = {
  // Surfaces
  white:        '#FFFFFF',
  bg:           '#FAFAFA',
  bg2:          '#F4F4F5',

  // Yellow ladder
  yellow:       '#FFC107',
  yellowHover:  '#E0A800',
  yellowPale:   '#FFF7CC',
  yellow50:     '#FFFDEB',
  yellowText:   '#6B5A00',

  // Ink + muted ladder
  ink:          '#0A0A0A',
  ink2:         '#1F1F22',
  muted:        '#52525B',
  muted2:       '#71717A',
  muted3:       '#A1A1AA',
  muted4:       '#D4D4D8',

  // Borders
  border:       '#E4E4E7',
  borderSoft:   '#F4F4F5',

  // Status pales
  success:      '#10B981',
  successPale:  '#D1FAE5',
  successText:  '#047857',
  danger:       '#E8401A',
  dangerPale:   '#FDEEE9',
  dangerText:   '#B91C1C',
  conv:         '#7E22CE',
  convPale:     '#F3E8FF',
  eng:          '#0E7490',
  engPale:      '#CFFAFE',
  hyb:          '#6B5A00',
  hybPale:      '#FFF7CC',
  info:         '#1D4ED8',
  infoPale:     '#DBEAFE',
};
```

Mobile-brand screens import as: `import { brandPalette as P, fonts, fmtMoney, fmtRupees } from '../../theme/tokens';`

**Existing `colors` / `lightColors` / `darkColors` exports preserved**: 24 Wave-3 follower/restaurant screens consume `lightColors` (yellow `#EAB308` differs from brandPalette `#FFC107` — different shades by design). Do NOT modify these — additive only.

---

## 8 · 3 EXTRACTED COMPONENTS (Flow 21)

Live under `Packages/Mobile/src/components/brand/`:

### 8.1 · `StatusPill.js` (~85 LOC)

**API**: `<StatusPill status="..." mode="default|transaction" />`

- `status`: string from canonical map (see §9 for all 34 entries)
- `mode`: optional. `'transaction'` overrides `pending` → yellowPale/yellowText (Conversions in-flight context)

Renders 9×3 px JetBrains-Mono-Bold pill, letter-spacing 0.3, uppercase. Fallback for unknown status = bg2/muted2 with uppercased status string as label.

**Exports `STATUS_MAP_DEFAULT`** so callers can introspect.

### 8.2 · `EmptyState.js` (~55 LOC)

**API**: `<EmptyState icon="[X]" title="..." sub="..." />`

- `icon`: mono placeholder text (e.g. `[$]`, `[NONE]`, `[BELL]`, `[PHOTOS]`, `[LINKS]`, `[DOCS]`)
- `title`: short string (Outfit-Bold 14)
- `sub`: longer string (PJS Medium 11.5, max ~260px wrap)

Renders dashed-yellowPale border card + 52×52 yellowPale tile.

### 8.3 · `ScreenHeader.js` (~85 LOC)

**API**: `<ScreenHeader title sub back onBack count countLabel />`

- `title`: string (Outfit-Bold 22, white on ink)
- `sub`: optional string (PJS Medium 11 muted-white) — also used for "← Campaign name" pattern
- `back`: optional bool — show "‹ Back" link above title
- `onBack`: callback for back tap
- `count`: optional number — render count chip on right (mono yellow on translucent-white)
- `countLabel`: optional string for count suffix ("sets", "results", etc.)

Renders ink topbar with 30×3 yellow rule. 5 variants observed (title only / title+sub / title+back / title+count / title+back+count).

**Note**: Some screens (Profile, Wallet, MediaGallery) intentionally do NOT use ScreenHeader — they have bespoke heroes (avatar circles, balance displays, centered titles). Don't force-fit.

---

## 9 · STATUSPILL CANONICAL MAP — ALL 34 ENTRIES (post-Flow 25)

Build up across Flows 21 → 22 → 23 → 25:

```js
export const STATUS_MAP_DEFAULT = {
  // ── New/in-flight (yellowPale + yellowText) ─────────────
  new:                 { bg: P.yellowPale,  fg: P.yellowText,  label: 'NEW' },          // Flow 21
  submitted:           { bg: P.yellowPale,  fg: P.yellowText,  label: 'NEW' },          // Flow 21
  sent:                { bg: P.yellowPale,  fg: P.yellowText,  label: 'NEW' },          // Flow 21
  applied:             { bg: P.yellowPale,  fg: P.yellowText,  label: 'APPLIED' },      // Flow 22
  negotiating:         { bg: P.yellowPale,  fg: P.yellowText,  label: 'NEGOTIATING' },  // Flow 22

  // ── In-flight pending (special) ─────────────────────────
  pending:             { bg: P.bg2,         fg: P.muted2,      label: 'PENDING' },      // Flow 21
                       // (mode='transaction' overrides to yellowPale/yellowText)

  // ── Engaged (infoPale + info) ───────────────────────────
  contacted:           { bg: P.infoPale,    fg: P.info,        label: 'CONTACTED' },    // Flow 21
  viewed:              { bg: P.infoPale,    fg: P.info,        label: 'VIEWED' },       // Flow 21
  responded:           { bg: P.infoPale,    fg: P.info,        label: 'RESPONDED' },    // Flow 21

  // ── Negotiation (convPale + conv) ───────────────────────
  countered:           { bg: P.convPale,    fg: P.conv,        label: 'COUNTERED' },    // Flow 21

  // ── Success/positive (successPale + successText) ───────
  converted:           { bg: P.successPale, fg: P.successText, label: 'CONVERTED' },    // Flow 21
  accepted:            { bg: P.successPale, fg: P.successText, label: 'ACCEPTED' },     // Flow 21
  completed:           { bg: P.successPale, fg: P.successText, label: 'COMPLETED' },    // Flow 21
  live:                { bg: P.successPale, fg: P.successText, label: 'LIVE' },         // Flow 21
  contracted:          { bg: P.successPale, fg: P.successText, label: 'CONTRACTED' },   // Flow 22
  active:              { bg: P.successPale, fg: P.successText, label: 'ACTIVE' },       // Flow 22

  // ── Negative/terminal (dangerPale + dangerText) ────────
  rejected:            { bg: P.dangerPale,  fg: P.dangerText,  label: 'REJECTED' },     // Flow 21
  declined:            { bg: P.dangerPale,  fg: P.dangerText,  label: 'DECLINED' },     // Flow 21
  cancelled:           { bg: P.dangerPale,  fg: P.dangerText,  label: 'CANCELLED' },    // Flow 21
  rejected_by_brand:   { bg: P.dangerPale,  fg: P.dangerText,  label: 'REJECTED' },     // Flow 22 alias

  // ── Terminal-grey (bg2 + muted2) ───────────────────────
  invited:             { bg: P.bg2,         fg: P.muted2,      label: 'INVITED' },      // Flow 22
  closed:              { bg: P.bg2,         fg: P.muted2,      label: 'CLOSED' },       // Flow 21
  expired:             { bg: P.bg2,         fg: P.muted2,      label: 'EXPIRED' },      // Flow 21
  withdrawn:           { bg: P.bg2,         fg: P.muted2,      label: 'WITHDRAWN' },    // Flow 21
  refunded:            { bg: P.bg2,         fg: P.muted2,      label: 'REFUNDED' },     // Flow 21
  slots_filled:        { bg: P.bg2,         fg: P.muted2,      label: 'SLOTS FILLED' }, // Flow 22
  walked_away:         { bg: P.bg2,         fg: P.muted2,      label: 'CLOSED' },       // Flow 23

  // ── Negotiation in-flight ───────────────────────────────
  awaiting_brand:      { bg: P.yellowPale,  fg: P.yellowText,  label: 'YOUR TURN' },    // Flow 23
  awaiting_influencer: { bg: P.infoPale,    fg: P.info,        label: 'WAITING' },      // Flow 23
  agreed:              { bg: P.successPale, fg: P.successText, label: 'AGREED' },       // Flow 23
  open:                { bg: P.yellowPale,  fg: P.yellowText,  label: 'OPEN' },         // Flow 23

  // ── Contract lifecycle (Flow 25) ────────────────────────
  draft:               { bg: P.bg2,         fg: P.muted2,      label: 'DRAFT' },        // Flow 25
  pending_influencer:  { bg: P.yellowPale,  fg: P.yellowText,  label: 'AWAITING INFLUENCER' }, // Flow 25
  pending_brand:       { bg: P.yellowPale,  fg: P.yellowText,  label: 'YOUR TURN' },    // Flow 25
};
```

**Flow 27 will likely extend further** with contract-specific statuses if any are observed (e.g. `sent_for_signature`, `partially_signed`, `pdf_pending`, etc.). Audit `BrandContractScreen.js` for any inline status colour maps before mockup-locking.

---

## 10 · NO-TOUCH LIST

**Window A territory:**
- `backend/**`, `backend/migrations/**` — entire backend
- `Packages/shared/api/**` — shared API client
- Settings hub layout (`Packages/brand-web/app/dashboard/settings/layout.js`) — Phase A9
- `Packages/brand-web/app/dashboard/settings/subscription/page.js` — Phase A7-brand + A11
- `Packages/brand-web/app/dashboard/settings/billing/page.js` — Phase A7-brand
- Admin tier editor pages (Phases A10/A10.5)

**System stability:**
- API call shapes (frozen contracts — every request body, every field name)
- Form field names (Razorpay, OTP, etc.)
- Route names (URL strings)
- AsyncStorage keys (`inflx_token` etc.)
- Role-routing branches (brand vs influencer vs follower vs admin)
- `Packages/Mobile/src/config/api.js` — committed empty; local edits via `git update-index --skip-worktree`
- `Packages/brand-web/app/dashboard/products/components/**` — listing engine spine (~5,500 LOC)

**Wave-3 follower screens consuming `lightColors`** (24 files, brandPalette adds extend tokens.js additively — never modify these existing exports):
- All `Packages/Mobile/src/screens/follower/Meals*`, `Restaurant*`, `Dining*`, `BookingConfirmed*`, `InfluencerStore*`, `FollowerWallet*`
- All `Packages/Mobile/src/components/restaurant/*`
- `Packages/Mobile/src/components/Location*`

**Process:**
- Never commit credentials (.env, etc.)
- Never `--force-push`, never `--no-verify`, never amend pushed commits
- Production-impacting deploys ALWAYS surfaced for explicit go
- `GOVERNANCE_OVERRIDE` for Rule 5 bypass = loud + recorded, never silent
- Don't extend the broken `backend/migrate.js` (broken past migration 013)

---

## 11 · ALL 9 MOBILE-BRAND FLOWS SHIPPED THIS SESSION (Flows 18-26)

| # | Slug | Screens | LOC | Commits | OTA versions | Status |
|---|---|---|---|---|---|---|
| 18 | redesign-flow-18-brand-mobile-notifications | BrandNotificationsScreen | 193 → 270 | acb7232 + 88cf532 | brand v68 / inf v57 / fol v31 | **GREEN** |
| 19 | redesign-flow-19-brand-mobile-store-sets | StorePreview + CampaignSetsList | 288+265 → 380+340 | 0a4bd6d + 3410dd3 | brand v69 / inf v58 / fol v32 | **pending-cert** (MSG91) |
| 20 | redesign-flow-20-brand-mobile-modal-form | Enquiries + ProposalInbox + InfluencerProfile | 349+395+530 → 480+490+660 | 57ab339 + 3091954 | brand v70 / inf v59 / fol v33 | **GREEN** |
| 21 | redesign-flow-21-brand-mobile-conversions-browse | Conversions + InfluencerBrowse + **3 components extracted** | 277+363 → 330+390 + new ScreenHeader/StatusPill/EmptyState | 5b649b6 + 4d07a0f | brand v71 / inf v60 / fol v34 | **pending-cert** (MSG91 + cold) |
| 22 | redesign-flow-22-brand-mobile-campaign-deep-dives | CampaignInfluencersList + ReviewQueue + StatusPill +7 | 488+330 → 520+360 | 35f8734 + cfa6706 | brand v72 / inf v61 / fol v35 | **GREEN** (warm-retry) |
| 23 | redesign-flow-23-brand-mobile-action-negotiation | ActionRequired + Negotiation + StatusPill +5 | 494+439 → 540+450 | f62e499 + b495d7b + a2b10f5 | brand v73 / inf v62 / fol v36 | **pending-cert** (cold + MSG91) |
| 24 | redesign-flow-24-brand-mobile-profile | Profile | 541 → 530 | 814fdc0 + 05e5d64 | brand v74 / inf v63 / fol v37 | **GREEN** (pre-warm) |
| 25 | redesign-flow-25-brand-mobile-media-gallery | MediaGallery + StatusPill +3 | 654 → 700 | e1deebb + ea85c7e | brand v75 / inf v64 / fol v38 | **pending-cert** (cold + MSG91) |
| 26 | redesign-flow-26-brand-mobile-wallet | Wallet | 645 → 680 | 5c75a00 + df68ce2 | brand v76 / inf v65 / fol v39 | **GREEN** (dual-probe pre-warm) |

**All contracts at `features/redesign-flow-N-<slug>/`** with full 7-file artifacts.
**All mockups at `design/wave2/flow-N-<slug>/web.html`** — open locally for visual reference.

**Total mobile-brand LOC restyled**: ~5,500+ across 15 unique screens + 3 extracted components + 34-entry canonical StatusPill map.

---

## 12 · BACKEND-DEFECT CARVES (carried from v3 handoff)

| Carve | Status | Notes |
|---|---|---|
| `backend-defect-auth-verify-otp-role-validation` | **CLOSED — misdiagnosis** | MSG91 OTP rate-limit flaking test preconditions. Pattern recurs throughout this session — see §14 mitigation. |
| `backend-defect-quota-check-missing-free-tier` | **POSSIBLY RESOLVED** | Window A's A10/A11/A12.1/A12.1.5 likely fixed. Recommend smoke-test by creating a real campaign on prod. |

---

## 13 · QA — DUAL-PROBE PRE-WARM DISCIPLINE (NEW · 2026-05-26)

**THE PATTERN that turns flaky pending-cert → clean GREEN first-run**:

```bash
# Always before pnpm qa:
cd /c/WORK/inflx-platform && powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force"
sleep 3
curl -s --max-time 60 "https://inflx-platform.onrender.com/v1/ota/manifest?flavor=brand&runtime=1"
curl -s --max-time 30 "https://inflx-platform.onrender.com/v1/admin/stats"
curl -s -X POST --max-time 30 "https://inflx-platform.onrender.com/v1/auth/refresh"
# NOW:
pnpm qa
```

**Why**: Render free-tier cold-start hydrates the OTA route first but other API routes (W3 auth contract / W4 admin stats / W5c refresh / W6 unknown / Settings hub page) remain cold and time out during their first request. The dual-probe forces full backend wake before QA fires.

**Track record this session**:
- Flow 19/21/23/25 (no dual-probe) → all pending-cert from cold-start flakes
- Flow 24/26 (with dual-probe) → both shipped FULL GREEN first try

Adoption: **make this the default**. Skip only if QA ran within the last ~5 min (Render stays warm ~15 min between requests).

**Classification rules when flake still happens** (per `feedback_qa_governance.md`):
1. **stale fixture/setup debt** → align helper to current contract
2. **business-rule drift** → align assertion
3. **genuine backend defect** → carve `features/backend-defect-*/`, leave RED until backend-fixed
4. **assertion drift** → fix assertion only if contract truly changed

**Never fake-green**. No `.skip`, no deletion, no weakening, no fabricated data. Uncertainty escalates to failure.

**Always state deploy posture**: deploy-inert vs real deploy. Real deploys are explicit conscious Step-14.

---

## 14 · PENDING-CERT FLOWS + RETROACTIVE CERTIFY PATH

**4 flows shipped pending-cert** (Flows 19, 21, 23, 25). Each because pnpm qa hit env-flake clusters (MSG91 throttle / Render cold-start) with zero causal link to the mobile-only changes in that flow.

**To retroactively certify each**:
1. Wait until MSG91 throttle clears + Render fully warm (typically 30-60 min between sessions)
2. Run dual-probe pre-warm per §13
3. Run `pnpm qa` — expect 76/76 GREEN
4. For each pending-cert flow, write a single deploy-inert close-out commit:
   ```
   chore(release): Flow N — certify retroactively (qa_all_green=true after warm-backend re-run)
   ```
   Edit the lock.json:
   - `status` → `"released"` (was `"deployed-pending-certification"`)
   - `release.qa_all_green` → `true`
   - `release.released` → `true`
   - `release.released_by` → `"founder · 2026-05-26 chat \"certify retroactively\""`
   - `release.released_at` → today
   - `release.qa_evidence` → add `run_3_certify` block with the clean run details
5. Commit + push with `GOVERNANCE_OVERRIDE="Maestro not yet wired for solo dev — retroactive certification of pending-cert flow N"` (Rule 5 fires because lock.json claims released=true for a Mobile-governed flow)

**Note**: alternative is founder device smoke-test → that also certifies the mobile redesign separately. Either path works.

---

## 15 · MOBILE-SPECIFIC GUIDANCE (carried from v3 handoff)

### Deploy mechanics
- **Push to main → Vercel auto-deploys brand-web/admin-web** (web; no mobile effect)
- **`pnpm publish-ota:all`** → single Node process publishes brand+influencer+follower bundles to Cloudflare R2 (3 audit registrations, shared bundle hash, ~10s per flavor). Per `feedback_ota_publish_strategy`.
- **NATIVE_RUNTIME** in `Packages/Mobile/src/services/otaUpdater.js` only bumps when native modules / gradle change — pure RN style changes do NOT bump (we haven't bumped this session).

### File structure
```
Packages/Mobile/
├── src/
│   ├── screens/
│   │   ├── auth/         (shared auth screens — Flow 1 already restyled the quintet)
│   │   ├── brand/        (CURRENT BUCKET — 19 screens, 1 remaining)
│   │   ├── influencer/   (NEXT BUCKET — 23 screens)
│   │   ├── follower/     (LAST BUCKET — 44 screens · DO NOT TOUCH for now)
│   ├── components/
│   │   └── brand/        (NEW — Flow 21 extraction: StatusPill, EmptyState, ScreenHeader)
│   │   └── StatusBadge.js  (LEGACY — Flow 23 dropped its consumer in ActionRequired; still exists for any other consumer)
│   │   └── restaurant/   (Wave-3 follower components — NO TOUCH)
│   ├── services/         (otaUpdater, etc.)
│   ├── config/
│   │   ├── api.js              (COMMITTED EMPTY · use git update-index --skip-worktree)
│   │   └── api-overrides.js    (local-only override)
│   ├── theme/
│   │   └── tokens.js     (HAS: colors + lightColors + darkColors + brandPalette + fonts + fmtMoney + fmtRupees + fmtNum + businessAccents · brandPalette added Flow 18, untouched since)
├── package.json
└── app.json              (Expo config)
```

### Metro / workspace gotcha
- Mobile has its OWN `node_modules` — NOT pnpm-workspace-managed
- Mobile cannot import from `Packages/shared/` (Metro has no monorepo config)
- `lib/api.js` for mobile is in `Packages/Mobile/src/services/`

### React Native styling discipline
- `StyleSheet.create({})` per screen — no global CSS, no cascade traps
- Palette via `import { brandPalette as P, fonts } from '../../theme/tokens'` (don't recreate as inline P const — drop the inline one in any pre-existing screen during rewrite)
- Press states: `Pressable` with `({ pressed }) => [...]` OR `TouchableOpacity activeOpacity={0.7}`
- Disabled states: `disabled={isBusy}` + add `opacity: 0.4` + explicit re-assert bg+color
- Text: `<Text>` component (NOT raw strings)
- Mono numbers: `<Text style={{ fontFamily: fonts.monoBold }}>`

### Maestro gate (gov-check Rule 5)
- Any commit touching `Packages/Mobile/src/**` that flips `release.released = true` MUST have `release.maestro_green: true` in lock.json — gov-check Rule 5 blocks the push otherwise
- **For this entire session we've used `GOVERNANCE_OVERRIDE`** with reason `"Maestro not yet wired for solo dev — mobile-brand bucket ships with manual founder smoke-test; Maestro setup deferred to its own contract"`. Continue this pattern for Flow 27 unless founder commits to wiring Maestro first.

### Mocking approach for mobile mockup HTML
- Mobile mockups authored as HTML at viewport `width=375` (iPhone-ish)
- Render as a phone-bezel frame with notch + status bar (see any Flow 18-26 mockup for template)
- Test data should mirror what mobile API consumers see

---

## 16 · KEY PATTERNS LEARNED THIS SESSION (Flows 18-26 specifics)

### 16.1 · Deploy-cadence chain
Every flow ends with TWO commits:
1. **feat(redesign): Flow N — <slug>** — page rewrite + contract artifacts. Push triggers Vercel/OTA. Founder explicitly approves via "go" / "pls go" / "pls proceed".
2. **chore(release): Flow N — backfill deploy.commit = <SHA>** — Step-14 close-out. Flips `release.released=true` (or stays false for pending-cert). Deploy-inert.

For pending-cert: lock.json status = `"deployed-pending-certification"`, `released=false`, `qa_all_green=false`, full failure breakdown in `qa_evidence`.

### 16.2 · gov-check contract completeness (Flow 23 lesson)
**ALWAYS write all of these contract docs BEFORE first push attempt**:
- `lock.json` (with approved=true + mockup_locked=true + all required fields)
- `01-spec.md`
- `02-workflow.md` (was skipped in Flow 23 → push blocked; fixed with follow-up commit)
- `03-expected-outputs.md` (recommended for completeness)
- `04-preview/mockups/web.html` (mirror of design/wave2 file)
- `04-preview/workflow-prediction.md` (optional but helpful)
- `05-impact.md`
- `06-diff/notes.md` (after implementation; required by Rule 4)

Use `mkdir -p features/<slug>/04-preview/mockups` + `cp design/wave2/<slug>/web.html features/<slug>/04-preview/mockups/web.html` to mirror.

### 16.3 · SDK boundary preservation
3 SDK boundaries hit this session — all preserved verbatim:
- **Flow 25** (`react-native-image-picker` `launchImageLibrary` + R2 `uploadFile` chain): preserved with exact signature, error-code branching (QUOTA_EXCEEDED), try/catch + finally
- **Flow 26** (`react-native-webview` Modal+WebView + Razorpay checkout.js CDN + `@react-native-async-storage/async-storage` + 3-message-type handler + mock-order branching): preserved with 5 HTML color literal swaps to brandPalette family (theme.color `'#1B2D5E' → '#0A0A0A'`)
- **Flow 27 anticipated** (signature pad + PDF generation + production lifecycle — see §18 below)

**Rule**: when touching a screen with SDK boundary, preserve the boundary code verbatim. Only swap palette literals + add font references. Add explicit verbatim notes in 06-diff/notes.md.

### 16.4 · Component extraction policy
After Flow 25, 9 screens (Flows 18-25 + Flow 26 partial) consume the 3 extracted components. **Retroactive migration of Flows 18-20** to consume the new components remains DEFERRED — those screens use inline equivalents that are byte-identical visually. Can polish in a future flow at zero risk.

**Don't extract more components in Flow 27 unless a NEW pattern appears 2+ times within Contract itself**. The Contract screen has bespoke elements (signature pad, PDF preview, production lifecycle state machine) that are likely single-use.

### 16.5 · Adjacent-fix pattern
Frequently encountered undefined / inconsistent inline status maps + ad-hoc hex literals. Treat as adjacent-fixes — replace with brandPalette tokens + canonical StatusPill. Document in 05-impact / 06-diff.

### 16.6 · Window A coordination
Window A pushed 5 backend commits during this session (A10 / A10.5 / A11 / A12.1 / A12.1.5). All landed cleanly above my flow commits via git push fast-forward. **Always run `git fetch` before suspecting a test regression** — Window A's pushes can change what `pnpm qa` baseline tests.

---

## 17 · CONTRACT FOLDER TEMPLATE (re-stated)

For every new flow:

```
features/redesign-flow-N-<slug>/
├── 01-spec.md              # problem/goal/scope/data
├── 02-workflow.md          # actor + preconditions + steps + success + edge (REQUIRED by gov-check Rule 1)
├── 03-expected-outputs.md  # per-step outputs + data assertions + visual evidence (recommended)
├── 04-preview/
│   ├── mockups/web.html    # mirror of design/wave2/<slug>/web.html
│   └── workflow-prediction.md  # tile → source mapping (optional but valuable)
├── 05-impact.md            # files / APIs / regression / migration / risk / time (REQUIRED by gov-check Rule 1)
├── 06-diff/notes.md        # before/after (populated AFTER implementation, REQUIRED by gov-check Rule 4)
└── lock.json               # state machine — approved/mockup_locked/released
```

**lock.json at impl-ready state** (mobile-specific):
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
  "mockup_locked_by": "founder · YYYY-MM-DD chat — locked <slug> mockup",
  "mockup_locked_at": "YYYY-MM-DD",
  "notes": "...",
  "release": {
    "qa_all_green": false,
    "released": false,
    "released_by": null,
    "released_at": null,
    "deploy_class": "production-impacting",
    "deploy_targets": ["ota:brand", "ota:influencer", "ota:follower"],
    "maestro_green": "n/a until release-flip; will use GOVERNANCE_OVERRIDE='Maestro not yet wired for solo dev' for Flow N"
  }
}
```

**lock.json at clean GREEN release** (mobile):
```json
{
  "release": {
    "qa_all_green": true,
    "qa_evidence": { ... },
    "released": true,
    "released_by": "founder · YYYY-MM-DD chat \"...\"",
    "released_at": "YYYY-MM-DD",
    "deploy_class": "production-impacting",
    "deploy_targets": ["ota:brand", "ota:influencer", "ota:follower"],
    "maestro_green": "overridden — GOVERNANCE_OVERRIDE='...'",
    "deploy": {
      "ota_brand": {...}, "ota_influencer": {...}, "ota_follower": {...},
      "vercel_brand_web": {...}, "vercel_admin_web": {...}, "render_backend": {...}
    }
  }
}
```

---

## 18 · FLOW 27 DETAILED PLAN — BrandContractScreen (THE FINALE)

### 18.1 · Scope
**Single file**: `Packages/Mobile/src/screens/brand/BrandContractScreen.js` · **1341 LOC** · biggest screen in mobile-brand bucket by 2× margin over MediaGallery.

### 18.2 · Audit findings from v3 handoff
- **Production lifecycle** (3 modes: visit/shipment/remote) with date pickers, location, notes, signature sketch, PDF generation
- **Standard clauses CRUD** (commercial_rights / category_exclusivity / content_ownership) + bonus input with live wallet lock calc
- **Dual-side contract flow** (draft → approve+send → influencer sign → brand sign) + re-approve if influencer hasn't signed yet
- **State machine complexity** — not just pure display
- **APIs**: `getContract`, `getMe`, `approveContract`, `brandSign`, `getProduction`, `getProductionDateRange`, `setProductionVisitDetails`, `acceptProduction`, `counterProposeProduction`, `flipProductionToRemote`, `dispatchProduction`, `completeProduction`, `initialiseProduction` (visit/shipment/remote)
- **Nav targets**: ContractPdf screen (if `c.pdf_url` exists)
- **Nav inputs**: from ActionRequired (signatures tab) or CampaignInfluencersList ("Open contract" button)

### 18.3 · SDK / native module dependencies
**Read the actual screen file first** to confirm — likely uses one or more of:
- Signature pad: probably a JavaScript-canvas-based library (e.g. `react-native-signature-canvas`) OR a custom React Native View with PanResponder
- PDF rendering: probably `react-native-pdf` OR opens via `Linking` to a download URL
- Date picker: probably `@react-native-community/datetimepicker` OR custom

**SDK preservation rule**: whatever's there, KEEP IT. Visual rewrite around the boundary only.

### 18.4 · StatusPill extension watch
Contract has several status states not yet in canonical map. After reading the screen, you may need to extend `STATUS_MAP_DEFAULT` with:
- `sent_for_signature` / `awaiting_signature` (likely yellowPale)
- `partially_signed` (likely infoPale)
- `signed` / `fully_signed` (likely successPale)
- `pdf_pending` / `pdf_failed` (yellowPale / dangerPale)

Add only what's actually consumed by the screen.

### 18.5 · Likely-bespoke patterns (don't try to extract)
- Signature pad UI — bespoke, single-use
- PDF preview button
- Production lifecycle state machine UI (visit/shipment/remote flip)
- Multi-clause editor with text inputs
- Wallet lock display with bonus addition

### 18.6 · Suggested approach
1. **Read** `BrandContractScreen.js` end-to-end first (1341 LOC — may need 2 reads if hits 25k tokens; use offset/limit)
2. **Inventory** all UI sections: hero, terms editor, clauses, bonus, production lifecycle, signature pad, action buttons, status banners, modals, etc.
3. **Inventory** all status states referenced + extend StatusPill if needed
4. **Verify SDK boundaries** — list every `react-native-*` import, every Linking.openURL, every native call
5. **Build mockup** — likely needs 2 phone frames (main contract view + production lifecycle modal/sub-screen) + side panel showing all state variants
6. **Surface for green signal** — flag the SDK boundary clearly and the StatusPill extension count
7. **Implement** preserving SDK boundary verbatim, palette + fonts swap only
8. **QA with dual-probe pre-warm** (per §13) — aim for FIRST-run GREEN
9. **Ship** as full GREEN release (released=true) if QA clears

### 18.7 · Risk callouts
- **Production lifecycle 3-mode state machine** is the most complex non-SDK logic in the bucket. Read carefully, preserve every state transition + every Alert flow.
- **Signature pad** — if it's `react-native-signature-canvas`, theme color likely embedded in props (similar to Razorpay HTML color swap). Find and update to ink.
- **Multi-section form** with bonus + wallet lock calc — preserve the math exactly (the calc may mirror Flow 23's bulk-sign lockAmount: `(base + bonus) * (1 + platform_fee_pct/100)`)
- **Dual-side flow** — different UI by `contract.status` AND by `contract.brand_signed_at` / `contract.influencer_signed_at` presence. Branch carefully.

### 18.8 · Estimated effort
**~200-300 min** total for Flow 27 (mockup 45 min · implementation 120-180 min · QA + ship 25 min). Largest flow in the bucket. Fresh context budget is the right call.

---

## 19 · AFTER FLOW 27 — NEXT BUCKETS

**Mobile-brand bucket COMPLETE** = founder smoke-tests + retroactive certification of 4 pending-cert flows (Flows 19, 21, 23, 25) per §14.

**Next bucket = mobile influencer (23 screens)**. Per `feedback_redesign_app_sequence`. Should follow same 5-step rhythm, same brandPalette, same 3 extracted components (now battle-tested).

Influencer screens live in `Packages/Mobile/src/screens/influencer/**`. Equivalent to brand screens but from the influencer perspective: receive offers, negotiate, accept, sign, submit content, track earnings.

After influencer bucket: **follower mobile (44 screens)**. Largest bucket. May need a different palette decision — followers are the consumer-facing audience; brand identity may need adaptation. **Defer that decision to the founder when the bucket starts.**

---

## 20 · TASK LIST STATE

26 tasks created across the prior session (all completed). Fresh window should:
- TaskCreate new tasks for Flow 27 (mockup / contract / impl)
- Mark them in_progress when starting, completed when done
- Don't recreate Flow 18-26 tasks — they're historical

---

## 21 · COMMUNICATION CADENCE (carried)

**Rule**: before any pause/rest/break, state when starting + what you'll do. After every phase/break/pause, report what-done + what-next in plain functional language.

**Standing autonomy**: founder delegates routine decisions. Deploy-inert work proceeds without asking. Production-impacting (push / OTA) gets explicit go.

---

# APPENDIX · ALL MEMORY FILES INLINED (per v3 pattern)

## A1 · `MEMORY.md` index (`C:\Users\aveen\.claude\projects\C--WORK\memory\`)

```
- user_role.md — solo/small-team founder running Chat-architect / Code-builder on INFLX
- project_inflx_overview.md — 3-sided platform, prod-as-staging, schema-driven listing engine spine, repo at C:\WORK\inflx-platform\
- reference_inflx_docs.md — pointers to CLAUDE.md, contracts-v1.md, OTA_WORKFLOW.md, migration runner precedents
- feedback_verify_twice.md — read the actual file before claiming a route/column/endpoint exists
- feedback_adjacent_fix.md — fix small in-scope bugs silently when already in the file
- feedback_stage_discipline.md — System A (feature) + System B (reliability) pipelines
- project_governance_roadmap.md — founder's 8-item ordered hardening roadmap + flow log
- feedback_comms_cadence.md — before any pause state when-starting + what-next
- feedback_deploy_cadence.md — migrate → commit → push → OTA; ask before deploying
- feedback_ota_publish_strategy.md — use publish-ota:all + dual-probe pre-warm before pnpm qa (UPDATED 2026-05-26)
- feedback_csv_first_seeds.md — draft master-table seeds as CSV
- feedback_redesign_flow_discussion.md — every flow gets scope+impact+expected-outcome discussion
- feedback_impact_terse.md — chat impact = one-line verdict
- feedback_redesign_5step_rhythm.md — locked 2026-05-23: 5-step rhythm
- feedback_redesign_app_sequence.md — brand-web → mobile brand → mobile influencer → follower mobile
- feedback_backend_first_tiles.md — every tile/metric must trace to a real backend field
- feedback_admin_role_gates.md — INFLX admin endpoints default to requireAnyAdminRole
- reference_qa_foundation.md — contract-driven QA: qa/+features/, pnpm qa + pnpm qa:db lanes
- feedback_qa_governance.md — tests NOT auto-trusted: classify every failure
- project_pnpm_workspace_casing.md — workspace globs packages/* but dirs are Packages/*
```

## A2 · Updated `feedback_ota_publish_strategy.md` key sections

Added dual-probe pre-warm pattern (Flow 26 lesson). Full file at the memory path. Summary:

**Dual-probe pattern** (before any `pnpm qa`):
```bash
cd /c/WORK/inflx-platform && powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force"
sleep 3
curl -s --max-time 60 "https://inflx-platform.onrender.com/v1/ota/manifest?flavor=brand&runtime=1"
curl -s --max-time 30 "https://inflx-platform.onrender.com/v1/admin/stats"
curl -s -X POST --max-time 30 "https://inflx-platform.onrender.com/v1/auth/refresh"
pnpm qa
```

Adds ~50s overhead on cold backend but eliminates the entire env-flake cluster.

---

# APPENDIX · GOVERNANCE.md (canonical charter — read at session start)

`C:\WORK\inflx-platform\GOVERNANCE.md` is 316 lines. Read it directly via the Read tool. Key sections:

- §1 Repo execution lifecycle (the 14-step spine)
- §4 Step-5 LOCK semantics (Rule 3 mockup-lock, Rule 4 before/after-diff)
- §5 Step-14 RELEASE semantics (Rule 2)
- §6 Failure taxonomy & classification
- §8 No-fake-green policy [ENFORCED]
- §10 Regression policy [ENFORCED] + Maestro mobile lane (Rule 5)
- §11 The three enforcement layers

**Five gov-check rules**:
- Rule 1: governed-path code requires approved contract + complete (01/02/05) files
- Rule 2: `release.released=true` requires populated release-evidence block
- Rule 3 (UI-governed): mockup_locked=true required
- Rule 4 (UI-governed): 06-diff/notes.md present + non-empty required
- Rule 5 (Mobile-governed): `release.maestro_green=true` required when flipping `released=true`

---

# APPENDIX · OTA_WORKFLOW.md (already at `Docs/OTA_WORKFLOW.md`)

87 lines. Key operational rules:
- Pure JS/CSS changes → no NATIVE_RUNTIME bump
- Native module / gradle change → bump NATIVE_RUNTIME + rebuild APK + reinstall + then publish OTA
- `pnpm publish-ota:all` is the canonical single-process command
- `OTA_PUBLISH_TOKEN` lives in `.env.ota` (gitignored) + Render env

---

# END OF HANDOFF v1 (mobile-brand bucket · Flow 27 prep)

**Recap of next actions (also at top §3)**:
1. `cd /c/WORK/inflx-platform && git log --oneline -12 && git status --short` → confirm HEAD = df68ce2
2. Read top entries of `project_governance_roadmap.md`
3. Read `CLAUDE.md` + `GOVERNANCE.md` + `LOCAL.md` + `Docs/OTA_WORKFLOW.md`
4. Dual-probe pre-warm + `pnpm qa 2>&1 | tail -10` (expect 76/76 GREEN)
5. Surface to founder: "Resumed from Flow 27 handoff. HEAD = df68ce2. Bucket 15/16. QA 76/76 GREEN. Want me to audit BrandContractScreen (1341 LOC) and propose a Flow 27 scope first, or dive straight into the mockup?"

**Mobile-brand bucket FINALE — Flow 27 BrandContractScreen awaits.**

After Flow 27 ships: bucket COMPLETE → propose mobile-influencer bucket (23 screens) per locked sequence.

You have everything you need. Pick up exactly where Window B left off at HEAD = `df68ce2`.
