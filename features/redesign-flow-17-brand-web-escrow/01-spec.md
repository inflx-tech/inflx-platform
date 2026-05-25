# Flow 17 · brand-web campaign escrow — spec

**Slug:** `redesign-flow-17-brand-web-escrow`
**Status:** locked
**Wave:** wave2 redesign (FINALE for brand-web bucket)

---

## File

| Route | File | LOC OLD |
|---|---|---:|
| `/dashboard/campaigns/[id]/escrow` | `page.js` | 155 |

## Scope correction (honest)

Handoff §11 listed Flow 17 as `/escrow + /waiting (168 LOC)` but `/dashboard/waiting` does not exist in the codebase — likely deleted earlier or handoff was misremembering. **Real Flow 17 scope = single escrow page (155 LOC).**

`/dashboard/billing` + `/dashboard/subscription` are both 6-LOC server redirects (Window A's Phase A9 — moved to `/settings/billing` + `/settings/subscription`). No restyle needed.

After Flow 17 ships, **brand-web is COMPLETE** per handoff §5 locked sequence. Bucket transition follows: mobile brand → mobile influencer → follower mobile.

---

## Backend audit (preserved verbatim)

`brandApi.getCampaignEscrow(id)` → returns:
- `summary{ total, total_locked, total_released, total_queued }` (rupees)
- `influencer_breakdown[]` per inf: `{ campaign_influencer_id, instagram_handle, influencer_name, tranches[] }`
- `tranches[i]`: `{ id, tranche_number, trigger_event, status (queued|locked|released), amount, released_at }`
- `campaign{ name, has_tranches }`
- `entries[]` (raw — used only for empty-state check `data.entries.length === 0`)

No phantom fields. No API contract changes.

---

## Scope (in-scope)

`.esc` wrapper. Layout:
- Crumb (mono caps) with back-links to campaigns/this-campaign
- Header: count chip (mono "{N} tranches across {M} influencers") · Outfit H1 "Escrow Breakdown" · yellow rule · sub-line (campaign.name + commission-only descriptor)
- **INK 4-KPI hero** (when has data): Total / Locked yellow / Released green / Queued info — all mono
- **Per-influencer cards**: header with @handle (Outfit) + fullname (mono muted) + tranche count right · tranche rows with:
  - status icon (palette colored: queued ⏳ yellow / locked 🔒 info / released ✓ success)
  - Outfit "Tranche {N}" + mono meta (trigger_event reformatted + released_at)
  - mono amount right
  - status pill palette mapping
- **Conversion-only notice** (when `campaign.has_tranches === false`): yellow-pale gradient card with 💸 icon + Outfit heading + body copy + "Open Conversions tab →" link
- **Empty state** (entries.length === 0): yellow-pale gradient with 🔒 icon
- Loading + error states palette-aligned

## Out of scope

- Backend changes
- New "release tranche" mutations (no UI for releasing today; backend handles tranche state changes automatically)
- Bulk-release across influencers
