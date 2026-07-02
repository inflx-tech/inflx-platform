# Feature Spec — Gallery Bulk-Assign (E-4)

> Let a brand organize media into category tabs in bulk (multi-select → assign a category),
> instead of one-asset-at-a-time editing. Approved in-session ("Yes — bulk-assign only"). Frontend-only.

## Problem / goal
The gallery's category "tabs" are filter chips (logo/brand_kit/product_shot/video/document/other).
Today the ONLY way to put an asset in a category is via its per-asset Edit box, one at a time; uploads
land untagged in "All". So the tabs stay empty and there's no real organize mechanism. Goal: select
many assets and assign a category to all at once.

## Scope
- In scope: multi-select on asset cards; "Select all"; a bulk bar (category picker + Assign + Clear)
  that adds the chosen category tag to every selected asset (union with existing tags).
- Out of scope (this batch): tag-on-upload; drag-and-drop; bulk-remove.

## Surfaces touched
- brand-web gallery only (app/dashboard/gallery/page.js — AssetsPanel + AssetCard). No backend, no migration.

## Data / contracts
- No schema change, no new endpoint. Reuses mediaGalleryApi.update(id, { tags }) (PATCH-replace of the
  tags array) — the same call the per-asset Edit modal uses. Bulk = union each asset's existing tags with
  the chosen tag, then update.

## Non-functional
- Preserve filter chips, upload, per-asset Edit, delete, usage bar, Links + Contracts sub-panels.
- Selection cleared on filter change (no stale ids). Assign disabled with no category / while assigning.
- Partial-failure surfaces an error, never crashes.
