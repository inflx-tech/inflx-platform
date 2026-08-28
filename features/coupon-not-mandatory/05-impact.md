# Impact

**Verdict: one refusal removed on the server. No migration, no phone change.**

| Target | What lands | Risk |
|---|---|---|
| Migration | **none** — the column is already nullable | **Nil** |
| Render (`backend/src`) | two refusals removed | **Low** |
| OTA | **nothing** | **Nil** |

## Why the risk is low, measured rather than argued

Read from production before changing anything:

* `coupon_code` is **nullable**, with a unique index — which permits many NULLs
* **6 of 6** `campaign_influencers` already carry **no** coupon
* **16 of 16** `follower_transactions` are attributed to a creator, and **0** carry a coupon

The rule refused to create something the database already holds and the money path already
handles. Sixteen real sales have been attributed with no coupon anywhere in the system.

## What does not change

* A coupon passed, or generated from a prefix, is stored exactly as before
* Uniqueness is still enforced
* A content set is still refused a prefix
* Nothing already stored is reinterpreted

## Rollback

Revert `backend/src`. Any creator invited without a coupon keeps a NULL — which the column has
always allowed and every reader already tolerates. **Nothing to unwind.**

## Test-suite position

Executing checks via `scripts/run-test-file.js`; the backend suite still cannot run. Certified
**no-regression**. **Never claimed green.**
