# Diff notes — Food dish groups (Slice 3A + 3B)

Founder explicitly waived the UI mockup ("build directly"). Admin page follows
the existing Home Builder pattern (cards + member-picker modal).

What was built + verified:
- Migration 115: `dish_groups` + `dish_group_dishes` (applied to prod).
- Admin: `/admin/dish-groups` builder — create tile, auto-suggest members by
  name (pre-tick), tick/untick, optional keyword, reorder/hide/delete. Backend
  CRUD gated `requireCapability('master_data')`.
- Follower discovery: `GET /follower/dish-groups` (tiles) + `GET
  /follower/dish-groups/:id/restaurants?lat&lng` → nearby restaurants serving a
  member dish OR keyword-matched dish, nearest-first, with varieties + from-price
  + rating + delivery.
- Tests: `food-dish-groups.test.js` 3/3 — returns correct restaurants (members
  + custom-via-keyword), nearest first, excludes non-serving, varieties +
  from-price; lists tiles; empty group → empty.
- brand-web `next build` exit 0.

Deferred (Slice 3C): the follower mobile tiles rail + result screen — to be
built after the founder creates tiles + lists real restaurants. Visual diff for
the admin page to be eyeballed post-deploy.
