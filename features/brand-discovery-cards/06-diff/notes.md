# Before / After — discovery scannable card (step 1)

**Before:** each creator was a cramped **64px single-line row** (`.ic`, 5-column grid) with
8.5px stat labels, 11px mono meta, and emoji markers (📍🎨⭐✉) — hard to scan; the "one
number that matters" was buried.

**After:** `CreatorRow` is an **IG-clean card**: avatar + name + tier pill + verify/scraped/
stale tags on top, a clean meta line (city · niche · N collabs, no emoji), and the **three
decision numbers as stat tiles — Followers · Engagement rate (green when strong) · Est. /
post**. The Add (onboarded) / Invite (scraped) action and row→profile navigation are
preserved exactly.

## Changed
- `influencers/page.js` — rewrote the `CreatorRow` JSX (off the `.inf` scoped palette, into
  IG-clean Tailwind). No data/behavior change.

## Verification
- **`next build` compiled clean** (77 pages).
- **Pending (web verify):** founder on Vercel — directory results are scannable cards;
  clicking opens the profile; Add/Invite still work.

## Known delta / deferred (later steps / backend batch)
- No content thumbnails yet (needs creator recent-posts data — backend batch); the mockup
  shows the target strip.
- Filter-bar restyle (sliders / pick-from-list / live), shortlist + compare, working
  invite-from-profile, and the one-design-system merge (.inf/.prp/.groups) are later steps.
