# Workflow Prediction — Follower Category admin

> Step 4. Predicted path through the mockup, mapped to `02-workflow.md`.

## Mockup
- `mockups/admin-follower-categories.html` — admin screen to manage the follower Find-screen tiles. **Navy admin theme** (matches the live /admin dashboard; the gold/cream palette is the follower app only).

## Predicted path
1. On deploy, the table is **seeded** with the 7 current tiles → `GET /follower/categories` is byte-identical to today (step 1). 
2. **Admin** opens **Follower Categories**, sees the 7 tiles with icon / label / key / order / member businesses / status (step 2).
3. **Admin** clicks **+ Add tile** → modal (label, icon, key, member businesses, sort order, status) → adds "Pets 🐾" with members pet_shop/pet_grooming → row appears Active (step 3).
4. **Admin** uses ↑/↓ to reorder Events above Home (step 4).
5. **Admin** clicks **Hide** on Stay Fit → pill turns Hidden, it leaves the follower endpoint; member businesses untouched (step 5).
6. **Admin** opens **Edit** on Eat → renames to "Food & Drink", swaps icon → reflected on the follower Find screen (step 6).

## Predicted observable end states
- Pre-edit follower payload == legacy hardcoded payload (seed parity).
- Admin edits reflected in `GET /follower/categories`.
- Table emptied/unreachable → follower endpoint falls back to the hardcoded 7 (no empty screen).

## Palette / standard
Navy admin theme (white cards, navy accents, green/grey status pills) — consistent with Master Dishes / Tag Vocabulary / App Sections.
