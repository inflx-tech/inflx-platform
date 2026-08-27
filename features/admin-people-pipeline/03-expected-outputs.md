# Expected Outputs — admin-people-pipeline

> Step 3 (cont.). Defined BEFORE coding. This is what the eventual
> implementation contract's QA report asserts against — and what the
> founder can check the mockups against right now. "Looks similar" is
> not an expected output; the mapping below is exact, item by item.

## Nav item count, before → after

**Before** (`Packages/brand-web/app/admin/layout.js`, current `NAV`):

| Section | Items |
|---|---|
| MANAGEMENT | Approvals, Brands, Influencers, Production Queue, Orders (5) |
| MARKETING | Triage, Add Lead, Verifications, Invitations, Inbox, Funnel, M-Settings (7) |

12 nav rows across the two sections (plus 2 section headers).

**After:**

| Section | Items |
|---|---|
| PEOPLE | Approvals, Influencers, Brands, Production Queue, Orders (5) |
| OUTREACH | Inbox, Funnel, Settings (3) |

8 nav rows across the two sections (plus 2 section headers) — 4 fewer
top-level rows (Triage, Add Lead, Verifications, Invitations each stop
being their own nav entry), even though nothing they showed is lost —
it all moves inside the Influencers/Brands tab sets.

## Old route → new tab fold-in map

| Old route | Old nav label | Folds into |
|---|---|---|
| `/admin/marketing/leads?target_type=influencer` | Marketing → Triage | Influencers → **Leads** tab |
| `/admin/marketing/leads?target_type=brand` | Marketing → Triage | Brands → **Leads** tab |
| `/admin/marketing/add` | Marketing → Add Lead | **+ Add Lead** button/modal on both Leads tabs |
| `/admin/marketing/invitations` | Marketing → Invitations | Influencers → **Invited** tab |
| `/admin/marketing/verifications` (influencer rows) | Marketing → Verifications | Influencers → **Pending Verification** tab |
| `/admin/approvals` (brand half) | Management → Approvals | Brands → **Pending Verification** tab |
| `/admin/approvals` (influencer half) | Management → Approvals | superseded by Influencers → **Pending Verification** (see `01-spec.md` data-gap note — this is the one genuine merge, not a pure rename) |
| `/admin/brands` | Management → Brands | Brands → **Live** tab |
| `/admin/influencers` | Management → Influencers | Influencers → **Live** tab |
| `/admin/marketing/inbox` | Marketing → Inbox | OUTREACH → Inbox (unchanged) |
| `/admin/marketing/funnel` | Marketing → Funnel | OUTREACH → Funnel (unchanged) |
| `/admin/marketing/settings` | Marketing → M-Settings | OUTREACH → **Settings** (renamed) |
| `/admin/approvals` (combined view) | — | new lightweight **Approvals** summary at `/admin/approvals` — counts only, deep-links to the two Pending Verification tabs |

Routes themselves are an implementation decision for the follow-up
contract (whether `/admin/influencers?tab=leads` or a client-side tab
state on one page) — not fixed here. What's fixed is which **content**
ends up under which **tab label**.

## What each tab reads (per Live source files, field names verified against real code)

| Tab | Reads from | Fields shown |
|---|---|---|
| Influencers → Leads | `marketingApi.listLeads({target_type:'influencer', ...})` | handle, name, city, niche/sub_niche, tier, followers_count, priority_score, outreach_status, phone/email/whatsapp (as channel dots), last_scraped_at |
| Influencers → Invited | `adminApi.listInvitations(status)` on `creator_invitations` | ig_handle, full_name, brand_name, proposed_fee, brand_message, follower_tier, followers_count, bio_email, bio_phone, invited_at, contacted_at, status (pending/contacted/converted/expired/declined) |
| Influencers → Pending Verification | `adminApi.listVerifications(status)` on `creator_profiles`, grouped by `claim_user_id` | ig_handle, full_name, followers_count, follower_tier, youtube_handle, bio_email, bio_phone, profile_pic_url, claim_user_name, claim_user_phone, claim_requested_at, verification_status, rejection_reason |
| Influencers → Live | `adminApi.getInfluencers(status, search, page)` on `influencers` | full_name, phone, city, inflx_followers, followers_count (+scrape_last_run gate), youtube_handle/youtube_subscribers (+youtube_scrape_last_run gate), status, created_at |
| Brands → Leads | `marketingApi.listLeads({target_type:'brand', ...})` | handle, name (business_name), city, industry/sub_industry, tier, followers_count, priority_score, outreach_status, contact channels, last_scraped_at |
| Brands → Pending Verification | `adminApi.getBrandQueue()` on `brands` (status='pending') | business_name/brand_name, name (contact person), phone, city+state, gstin, address_line, pincode, category, email, created_at |
| Brands → Live | `adminApi.getBrands(status, search, page)` on `brands` | business_name, contact_name, phone, category, city, status, wallet_balance, platform_fee_pct, created_at |
| Approvals (summary) | `adminApi.getStats()` → `pending_approvals.{brands,influencers}`, `pending_verifications`, `pending_invitations` | 3–4 count tiles + "Review brands →" / "Review influencers →" deep-links; no row-level data, no action buttons |

## Data assertions the follow-up (implementation) contract must satisfy

- `influencers.status` for a row that was verified via Pending
  Verification must read `approved` when the Live tab loads it — this
  is the one place behavior actually changes, not just moves (see the
  merge gap flagged in `01-spec.md`).
- `brands.status` behavior is unchanged — Pending Verification writes
  it exactly as today's Approvals-queue brand half does.
- Removing the inline modal from `admin/brands/page.js`'s list and the
  standalone action from `admin/influencers/[id]/page.js` must not
  remove the `canFee` platform-fee-override button, which is an
  unrelated finance action that happens to sit in the same row today.

## Visual evidence required (for this contract)

- `04-preview/mockups/sidebar-nav.html` — full sidebar, PEOPLE and
  OUTREACH sections visibly separated from the untouched
  OVERVIEW/CONTENT/REFERRALS/FINANCE/PRICING/SETTINGS sections.
- `04-preview/mockups/influencers-tabbed.html` — 4 tabs rendered, Leads
  active, populated with representative rows (not empty state).
- `04-preview/mockups/brands-tabbed.html` — 3 tabs rendered, Leads
  active, populated with representative rows.
- `04-preview/mockups/approvals-summary.html` — count tiles + deep-link
  buttons, no per-row action controls anywhere on the page.
- No network calls in the mockups — static HTML with inline sample
  data only, per the preview-machinery convention.
