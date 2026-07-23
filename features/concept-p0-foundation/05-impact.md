# Impact — concept-p0-foundation

**Verdict: production-impacting (backend + brand-web + mobile OTA), zero
behaviour change for any EXISTING data path; new capability + dead-code
removal only.**

- Allocation: legacy `scope='category'` configs carry only the string → the
  `section = $2` branch still runs, byte-identical. Node branch fires only for
  configs that carry `category_node_id`, which nothing has written until this
  release. `getCampaignProducts` change: store/category-scoped assignments now
  resolve scoped-live instead of "all brand products" — this is the intended
  correctness fix (creator parity with follower store); hand-picked and
  legacy no-scope configs are untouched.
- Rule engine: new rule_json keys are additive; existing saved rules contain
  neither key (validator previously stripped unknown keys) → no saved rule
  changes behaviour. New SQL clauses are appended only when keys present.
- System B deletion: every deleted route served surfaces with no follower
  visibility and (per migration headers) empty tables. `experience_template`
  section rows: none exist in prod; if one appeared it now hides instead of
  rendering empty — same visible outcome. Proposal-accept no longer seeds a
  draft experience (best-effort side write to an empty, unread table).
- Mobile: deleted screens were the studio (replaced in Phase 2) + two
  navigator-orphans; no reachable navigation path breaks. OTA required to ship
  the navigator changes.
- QA: 5 stale spec files + 2 Maestro flows testing deleted surfaces removed
  (failure taxonomy: stale — surface deliberately deleted). Pre-existing
  mobile FollowerWalletScreen suite failure (react-native-vector-icons jest
  transform, file untouched) documented, not masked.
- DB: no migrations. System B tables remain (empty) for a later drop.
