# Workflow Definition — Wave-1 Quick Wins

## Actor
- A-1/A-2: a brand visitor / logged-in brand on the web.
- B-3/C-1: a logged-in superadmin on the admin panel.
- E-5: a logged-in brand on the media gallery.

## Preconditions
- A valid brand account (A-1), a superadmin account (B-3/C-1), and at least one media
  asset in the gallery (E-5).

## Workflow steps (user-observable)
1. Brand logs in via `/login` → lands on dashboard. After 15+ minutes of activity and a
   page navigation → **stays logged in** (previously: bounced to `/login`). [A-1]
2. Visitor opens the homepage → clicks "Sign In" or "Get Started" → **navigates to
   `/login`** (previously: scrolled to an inline old widget). The old embedded brand
   register form is gone; marketing sections + footer still render. [A-2]
3. Superadmin opens Admin → Payment Config → edits GST %, a TCS field, GSTIN, and the
   T3 release-after-days → Save → reloads the page → **the edited values persist and
   display** (previously: reverted to defaults). [B-3/G-1]
4. Superadmin opens Admin → Pricing → Marketplace Categories (L3) → **the screen loads
   and lists categories**; create/edit/delete succeed (previously: 404). [C-1]
5. Brand opens the media gallery → thumbnails show the **whole image** without cropping. [E-5]

## Success definition
- A-1: session survives past 15 minutes without re-login.
- A-2: every homepage auth CTA routes to `/login`; no inline brand-register path exists.
- B-3/G-1: a saved GST/TCS/identity/T3 value round-trips through save → reload.
- C-1: `/admin/categories` responds (not 404) with correct role gating.
- E-5: gallery images are fully visible (no half-cut).

## Failure / edge workflows
- paymentConfig DB read fails → service returns prior hardcoded defaults (no crash, no
  behavior regression).
- Non-superadmin hits a categories write endpoint → 403 (role gate).
