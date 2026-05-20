# Spec — _demo-preview (showcase, never released)

> **This is a permanent showcase.** It exists so the founder can run
> `pnpm preview:open _demo-preview` and see what the preview-machinery
> produces for a real (already-shipped) feature. It will never be
> released, never modify production, never satisfy gov-check for a
> real change. The `_` prefix excludes it from
> `governance-check.mjs:90`.

## What's demonstrated

Two mockups + one workflow prediction, grounded in already-shipped
features (commits `bfcd788` + `1c75df4`) so the founder sees the
machinery on familiar ground:

1. **`01-follower-public-browse.html`** — mobile-portrait mockup of
   the follower deal browse screen as it works *after* Q1 shipped
   (anonymous browsing; city-based feed; sign-in only at purchase).
2. **`02-search-with-verified-tag.html`** — desktop-wide mockup of
   the brand-web influencer search results showing both verified
   (registered + admin-approved) and unverified (scraped/pending)
   creators side by side, with the explicit `is_verified` tag added
   in Q3.
3. **`workflow-prediction.md`** — a worked example of what a good
   workflow prediction looks like, for the Q1 feature.

## How to read this

`pnpm preview:open _demo-preview` should open an HTML page in your
default browser with all three artifacts rendered. The mockups should
look like the real screens (Tailwind via CDN; static, no live data).
The workflow prediction should render as clean markdown with sections
for trigger / steps / end state / edge cases / blast radius / what
changes vs current.

## Why a permanent showcase

Future feature contracts will be created and released one by one —
none of them is a stable "look at this to learn the machinery"
example, because each gets its own contract folder and gets
historically frozen at release time. A dedicated demo folder keeps
the worked example available regardless of contract churn.
