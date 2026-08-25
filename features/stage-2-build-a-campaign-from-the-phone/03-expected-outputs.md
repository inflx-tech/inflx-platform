# Stage 2 — expected outputs

What must be true when this stage is done. Each row is checkable, and the check is named.

---

## 1. Database

| # | Assertion | How it is checked |
|---|---|---|
| D-1 | `campaign_sets.channels_json` exists, JSONB, nullable, no default that could reject a historical row | migration file + `\d campaign_sets` |
| D-2 | No existing `campaign_sets` row is modified by the migration | row-count and checksum before/after; the migration is additive DDL only |
| D-3 | A phone-built sales set stores `goal='conversion'`, `set_budget` NULL | W3.2 |
| D-4 | A phone-built content set stores `set_budget` = `SUM(agreed_fee)` of its own creators | W4 |
| D-5 | `campaigns.end_date` is NULL whenever any set is `conversion`, regardless of a paid set's window | W4 — this is the existing `campaignRollup` rule and must not regress |
| D-6 | Every published `campaign_influencers` row from the wizard carries a non-NULL `agreement_id` **and** a non-NULL `alloc_scope` | W6 |
| D-7 | Every briefed agreement is `status='consumed'` with `consumed_campaign_id` and `consumed_ci_id` set | W6 |
| D-8 | Abandoning the wizard leaves every ticked agreement `status='ready'` and writes no `campaign_influencers` row | W7 |

---

## 2. Backend

| # | Assertion | How it is checked |
|---|---|---|
| B-1 | `POST /campaigns/:id/sets` accepts a paid set with **no** `set_budget` and does not throw | API test — today this throws `set_budget is required` |
| B-2 | `set_budget` for a paid set is recomputed server-side on every invite and every set write | API test: invite two creators at ₹12,000 and ₹18,000 → `set_budget` = 30000 without the client sending it |
| B-3 | `campaigns.total_budget` still equals the sum of paid `set_budget` after B-2 | `campaignRollup.derive` unit test, unchanged |
| B-4 | Publish refuses a sales/hybrid set where any creator has `alloc_scope IS NULL`, naming her | API test |
| B-5 | Publish refuses a sales/hybrid set with no offer resolved for a creator, naming the set | API test |
| B-6 | Publish refuses when a chosen agreement is no longer `status='ready'`, naming her | API test — age `expires_at` in the fixture |
| B-7 | Publish refuses an offer whose scope contains a product not in the brand's live catalogue, naming the product | API test |
| B-8 | The existing wallet blocker still fires and still names required vs available | API test — regression |
| B-9 | Drift **warns**, never blocks: `agreement_warnings[]` is returned and publish still succeeds | API test |
| B-10 | A brand-authenticated basket preview returns the winning offer, the discount, the shopper total and the creator's earning, computed by `offerResolution.resolveBestOffer` — **not** by a second copy of the maths | API test asserting the same input produces the same winner as the follower path |
| B-11 | `channels_json` is guidance only — it blocks no invite, no publish, no sale | API test: publish succeeds with `channels_json` NULL and with an unmet minimum |

---

## 3. The brand phone

| # | Assertion | How it is checked |
|---|---|---|
| M-1 | Campaigns tab shows **+ New**; the "Create new campaign on web" link is **gone**, not merely hidden | handset walk W1 + a grep asserting `openWebDashboard('/dashboard/campaigns')` no longer appears in `BrandCampaignListScreen.js` |
| M-2 | The shell asks exactly two things | W2 |
| M-3 | Ends and Budget on a sales set render **disabled and explained**, not absent | W3.2 |
| M-4 | No "who posts?" step exists in any branch | W3.2, W4 |
| M-5 | Step 3 shows only aim-matching agreements, and says how many were hidden | W3.3 |
| M-6 | Every agreement row shows days-left, red under 14 | W3.3 |
| M-7 | Section ① is read-back; the only per-creator control is *what she can sell* | W3.4 |
| M-8 | Each allocation scope states its auto-join behaviour before it is chosen | W3.4 |
| M-9 | Section ② is closed with a reason on a content set, and payment stages appear instead | W4 |
| M-10 | The basket preview names the winning offer, the shopper total, and the creator's earning | W3.5 |
| M-11 | Review names every drifted term, by creator and by field, with a route back | W5 |
| M-12 | Each of the five publish blockers is shown in plain language, naming the thing at fault | W5-a…e |
| M-13 | **One** product picker component serves allocation, offer scope, and both pre-existing callers | grep: exactly one picker implementation under `Packages/Mobile/src` |

---

## 4. Regression and governance

| # | Assertion |
|---|---|
| R-1 | Brand web can still create, edit and publish a campaign, including with a typed `set_budget` |
| R-2 | The creator's one-click accept on an agreement-backed invite is unchanged (Part 6) |
| R-3 | `pnpm qa` certified **no-regression** against the 93-failure baseline. **Never claimed green** |
| R-4 | Mobile suite green |
| R-5 | Duplicate-route check clean across every stack in both apps |
| R-6 | `06-diff/notes.md` written: what was promised, what was built, **what diverged**, what to check |
| R-7 | Founder walks W1–W8 on a handset. This is the gate; nothing deploys before it |

---

## 5. What this stage explicitly does not have to prove

* That a shopper buys through the campaign — that is Stage 6 and `L5` in
  `Docs/TEST_PLAN_PARTS_1_TO_6.md`
* That the needs-you badges roll up — Stage 3
* That open-group sets work — out of scope, and defective per `D-3`/`D-4` in the test plan
* That web has the new pick-list — phones first, by the founder's instruction
