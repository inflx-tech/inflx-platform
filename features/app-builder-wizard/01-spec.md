# Feature Spec — App Builder 4-step wizard (Cleanup P2)

> Step 2 of the contract-driven workflow. Written BEFORE any code.
> Program: Section System Cleanup (Docs/SECTION_SYSTEM_SPEC.md LOCKED
> 2026-07-03, §5 + §9 founder decisions). Predecessor: P1
> features/section-scheduling/ (RELEASED — backend already accepts
> starts_at/ends_at + validates config_json).

## Problem / goal
Creating a section today spans two admin screens (Section Library then App
Builder), design vocabulary is split across three fields (`shelf_type`,
`config.style`, `presentation_type`), tap wiring differs per kind, and there
is no UI for the new schedule fields. The founder locked business language and
a 20-design catalog; the admin UI must present it.

Goal: ONE "Add section" flow with four steps — **1 Design · 2 Content ·
3 Display · 4 Action** — over the existing backend, plus the P1-CLEAN
retirements. A shop owner–level user must be able to create any section kind
without documentation.

## Scope
- In scope (ALL admin-web, `Packages/brand-web/app/admin/sections/`):
  1. **Step 1 Design** — thumbnail catalog grid grouped (Shelves / Banners &
     frames / Structure), business names per SECTION_SYSTEM_SPEC §3.
     P2 exposes the LIVE/ALIAS designs; P3-NEW designs (Hero slider,
     Announcement strip, Split banner) render greyed with a "P3" chip.
     Picking a design writes `config_json.design` (canonical id) alongside
     the legacy fields (aliases — zero payload/renderer change).
  2. **Step 2 Content** — tabs by kind: *Automatic* (Kind-1 rule list with
     plain-English labels + one-line source notes), *My rule* (Section
     Library builder INLINE: business/sub-category/tags/price/sort/offer +
     live "matches N" preview via existing `/admin/section-library` +
     `/preview` endpoints; saving creates/updates a reusable library row),
     *My images* (per-design upload slots with expected pixel sizes,
     labels, badges). Tabs shown/locked per the picked design's allowed fills.
  3. **Step 3 Display** — page scope + world (existing), position, enabled,
     and NEW `starts_at`/`ends_at` datetime pickers with plain copy
     ("Goes live / Disappears — leave empty for always on"). Shelf list rows
     show schedule chips (Scheduled · Live until … · Expired).
  4. **Step 4 Action** — one destination picker (Product grid / Category
     page / Custom page) writing `config_json.tap_destination`; per-tile
     overrides inside the images editor use the same component.
  5. **Edit-in-wizard** — existing sections open in the same wizard; legacy
     fields resolve to catalog ids via the alias map.
  6. **P1-CLEAN retirements (founder decision #1; all admin-web):**
     - Fix `RULE_FOR_TYPE.products='top_by_sales'` (dead rule → renders
       empty) → default `products_in_category`.
     - Hide offer-gated creator rule twins from pickers (rows already saved
       keep serving; picker offers the listing twins only).
     - Remove the dormant Collections surface + `collection` preset IF
       verify-twice confirms zero live usage (backend endpoints untouched).
     - Legacy follower-categories admin page: VERIFY table overlap with Home
       Builder first; retire the page only if it is a true duplicate,
       otherwise leave + record findings in this contract's 05-impact.
- Explicitly out of scope:
  - Backend changes of any kind (P1 covers the API; catalog `design` id is an
    unknown-key pass-through).
  - New renderer designs / mobile code (P3).
  - City-scope UI, analytics (P5). Per-store layouts (out of v1).

## Surfaces touched
- App(s): brand-web ADMIN only (`Packages/brand-web/app/admin/sections/` +
  small shared components; possibly `section-library/page.js` link text).
- Roles involved: admin.

## Data / contracts
- No new tables/columns/migrations. No new endpoints.
- Writes use existing: `PUT /admin/sections/:screen` (now accepting
  starts_at/ends_at + validated config_json), `POST/PATCH
  /admin/section-library`, `POST /admin/section-library/preview`,
  stock-upload presign for images.
- `config_json.design` written on create/edit (string; tolerated by P1
  validation as an unknown key; becomes canonical in P3 renderer work).

## Non-functional
- Auth/role gates: unchanged.
- Failure modes: PUT 422s surface the field-level message inline on the
  offending wizard step; library preview failure degrades to "preview
  unavailable" (never blocks save); legacy rows with unknown shapes open in
  the wizard with a raw-JSON fallback panel (existing editor retained).
- Live phone preview pane: retained and updates per step.
- Release class: **production-impacting** (Vercel auto-deploys brand-web on
  push). Explicit founder go before push. Mockup-lock + before/after-diff
  gates ENFORCED (UI-governed).
