# campaign-coupon-optional-prefix — impact

**Verdict: behaviour-relaxing bug fix — one validation loosened (handpick
prefix), one hole closed (NULL-coupon invite), zero disturbance to
existing campaigns.**

## Mechanics
- Existing sets/invites: untouched — no schema change, no data migration.
  Sets that already have a prefix behave exactly as before.
- Frontend: validation + navigation + labels in the new-campaign wizard
  only. No other screen imports this page.
- Backend createSet: the 422 for missing coupon_prefix now fires only for
  open-group conversion/hybrid. Handpick payloads with prefix=null are
  accepted and stored as NULL (column already nullable; invite path
  already handled NULL prefix).
- Backend invite: new 422 when a conversion/hybrid invite has neither
  custom code nor set prefix. Previously this inserted coupon_code=NULL —
  an influencer whose sales could never attribute by coupon. The wizard
  never produced this payload when the old prefix rule held; after the
  relaxation the wizard's own validation prevents it, and this 422 is the
  API-level backstop (vertical-gating rule: enforce at API, not just UI).
- Open-group: no behaviour change (prefix still mandatory both layers).
- Mobile/influencer app: reads ci.coupon_code and cs.coupon_prefix for
  display only; NULL prefix on handpick sets renders nothing new — the
  code itself is always present per the invariant.

## QA
Full lane: 75 passed + 4 setup-timeout flakes (W2, W5a, W5b, C5 — all
hung at 60s test-timeout during parallel setup, 445–490s wall). Targeted
rerun of those specs: 17/17 green in 17.7s. Classified infrastructure
flake per QA governance; no assertion ever failed. No test pins the old
prefix-mandatory behaviour (grepped qa/ + backend/tests).
