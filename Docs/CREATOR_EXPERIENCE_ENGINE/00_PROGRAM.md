# Creator Experience Engine — Program Spec

> **Status:** Phase 0 (spec lock) — PAPER ONLY. No code, no migrations, nothing deployed.
> **Owner:** founder (Chat-architect) + Code-builder.
> **Rule:** extend, don't rebuild. Every existing working module is reused unless a spec here says otherwise.
> Locked understanding lives in memory: `project_creator_commerce_vision`.

This program turns the Creator Commerce vision into a buildable system: admin authors **reusable Experience Templates** (Shopify-theme style); creators **instantiate** them by picking Theme → Products → Featured Image → Publish; an **Adaptive Renderer** draws each experience into any layout from an **Asset Pack** (ingredients, never a finished banner), obeying per-layout **Layout Contracts**. One theme serves 1 or 1,000 creators with zero extra admin work.

The spine:
```
Blueprint → Theme (business definition) → Design + Section Style
   → Experience Template → (creator instantiates) → Asset Pack
   → Adaptive Renderer under Layout Contracts → every layout, every context
```

---

## Phase map

| Phase | Name | New vs Extend | Functional outcome |
|---|---|---|---|
| **0** | Spec lock (this folder) | paper | Whole build agreed on paper before any code. |
| **1** | Design System & Tokens | NEW (seed + admin catalog) | Admin picks from curated moods/palettes/type/backgrounds/presets. |
| **2** | Theme Library + wizard + Blueprints | NEW | Admin creates "Street Style" in minutes from a blueprint. |
| **3** | Design Library + Section Styles + Layout Contracts | EXTEND catalog → data | Layouts declare what they show/hide per size. |
| **4** | Adaptive Renderer | NEW (core engineering) | One theme renders into Hero/Tile/Story/Magazine, no banner, no resize. |
| **5** | Experience Templates + Home Builder placement | NEW object + EXTEND engine | Admin assembles + places "Street Style Hero" on Fashion Home. |
| **6** | Creator Experience Studio | EXTEND Lookbooks | Creator publishes an experience in 3 taps; followers see it. |
| **7** | Creator Imagery / Asset-Pack pipeline | NEW (flagged) | Creator photos flow; right images per context (brand vs creator store). |
| **8** | Scoped + theme-aware proposals + store browse | EXTEND proposals + NEW surface | Creator browses a store and pitches a themed experience. |
| **9** | Automatic + Mixed sections | EXTEND rule engine | Under ₹999 / Best Sellers / BOGO / "Rahul's Street Style + Flat 20%". |
| **10** | Signals + learning loop | NEW tracking + EXTEND ranking | Trending/Most-Viewed re-rank; admin refines library from evidence. |

Genuinely-new code concentrates in **Phase 4 (renderer)** and **Phase 7 (imagery)**. Everything else is seed content or additive extension.

---

## How we run each build phase

Per the contract-driven discipline (`feedback_stage_discipline`, `feedback_redesign_5step_rhythm`):
1. Short **spec/contract** for the phase (discuss-first) → agreed before code.
2. Build behind the QA lane (`pnpm qa`), classify every failure (no fake-green).
3. **migrate → commit → push → OTA** only on founder's explicit say-so (`feedback_deploy_cadence`).
4. **On-device verify** before the phase is called done.
5. Founder green light before the next phase begins (one-phase-at-a-time).

---

## Decisions to LOCK in Phase 0 (recommendations — confirm together)

These were the parked architectural forks. Phase 0 exists to close them. **Recommended** answers below; none are committed until founder confirms.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | Experience object | (a) extend `creator_lookbooks`; (b) NEW `creator_experiences` + `experience_products` | **(b) NEW tables**, reusing the lookbook_products *pattern*. Experiences carry template/theme/asset-pack + a template-bound lifecycle that differs from a manual lookbook. Keep lookbooks as-is. |
| **D2** | Template placement → follower | (a) template WRITES `section_config` rows; (b) engine RESOLVES templates live | **(a) reuse section_config** — add `template_id` + a new `rule='experience_template'`. Inherits placement, scheduling, location, hide-empty for free. |
| **D3** | Asset Pack scope | (a) one pack per experience; (b) shared creator-level bank | **(b) two-level**: creator-level **Asset Bank** (approved media, reusable) + per-experience **Pack** (a selection). Directly enables "one shoot → many experiences". |
| **D4** | Section Style storage | (a) full library table now; (b) enum on template for v1, promote later | **(b) enum on template for v1.** Design Library (with Layout Contract) is first-class; Section Style promotes to its own library in a later phase. |
| **D5** | Backgrounds | (a) curated library (pick); (b) generated/procedural | **(a) curated library.** Generation deferred indefinitely; not on the critical path. |

**LOCKED 2026-07-10 (founder):** D1 = NEW tables · D2 = reuse section_config · D3 = two-level bank+pack · D4 = enum on template (v1) · D5 = curated backgrounds. All recommendations accepted. Phase 0 spec is now locked; ready for Phase 1 on founder's signal.

See `05` note inline in each spec file for how the recommendation shapes the tables.

---

## Files in this Phase 0 pack
- `01_DATA_MODEL.md` — proposed new tables + exact extensions to existing tables.
- `02_LAYOUT_CONTRACTS.md` — the renderer's rulebook (Required / Optional / Hidden per layout).
- `03_TOKEN_CATALOG.md` — moods / palettes / typography / backgrounds / presets + the one-time design-asset workstream.
- `04_EXTEND_VS_ADD.md` — reuse / extend / new map, grounded in current files.

**Phase 0 is complete when founder marks D1–D5 locked and approves these four files.**
