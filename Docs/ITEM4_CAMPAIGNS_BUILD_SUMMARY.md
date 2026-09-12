# Item 4 — Campaigns and Sets: build summary (12 September 2026)

Built to rules v1.14 §5B and §5, the locked mockups C1–C11 (updated 12 Sep with the declined count), the
gap-check prompt, and your approval message. **Nothing is deployed.** Deploying = apply migration 180,
push, publish one OTA bundle (brand app). The creator app is untouched.

## 1. What changed

**Database (migration 180, additive, dry run on production clean):** `campaigns.updated_at` and
`started_from_group_id`; `campaign_sets.branch_id`, `created_at`, `updated_at`, `expired_at`; a check that
a Store Visit set names a branch; indexes on sets by campaign, on the expiry scan, and on invitations by
set and status. No backfill: the nine production sets read as drafts that need a date.

**Server.** A new rules module (`campaignState.service`) holds the states, counts, cutoff, locks and delete
rules, so the summary endpoints, the older create/update/delete, the invite path and the expiry job all
read one definition. Three new read endpoints power the tab (list, campaign detail, set detail; another
brand gets 404). The older endpoints gained the item 4 rules with your exact messages: name lengths, Aim,
mode, branch for Store Visit, posting date at least seven days ahead, calculated cutoff. Duplicate copies
settings only. The cross-set guard ignores dead and deferred rows, in both the invite path and the
open-group broadcast. A branch a set still names refuses to be removed, readably. Store Visit eligibility
now checks the set's own branch city. An hourly job expires sets nobody signed by the cutoff.

**The locks, plainly.** Before this item nothing was locked. A brand, or the website, could change a live
set's Aim, posting date, mode of work and branch after creators had signed, with no notification. From
this release, once the first invitation goes out those four fields refuse to change with "This can't be
changed after you've sent invitations." The set name still changes. This is the one change a brand with a
running campaign could notice, and it is what the rules doc asked for.

**Phone (brand app, OTA, no native module).** The Campaigns tab replaces "coming soon" with five screens:
the list (Live / Drafts / Past), New campaign, New set with the date picker, Campaign detail with the ⋯
menu, and Set detail with every state, the duplicate sheet and the confirms. "New campaign" from a
creator group now opens the real screen with the group attached.

**Website (your two decisions).** The creator page's "+ Invite to Campaign" buttons now say invitations are
sent from the Brand app; the modal is kept in the file but never shown. The profile page's Branches &
Outlets editor is replaced by "Branches are managed in the INFLX Brand app", and saving the profile no
longer writes the old branches column. Nothing else on either website changed.

## 2. Decisions carried out exactly as you answered
Seven days (both sides, plus the test that pins them) · states derived from the sets, the old status enum
untouched · cutoff always calculated, `invites_close_at` still written · Completed behind one helper ·
duplicate settings-only with channels, branch, unique name and rollup · cross-set fixed in both places ·
404 on the new endpoints only · set delete blocked by any invitation, foreign keys answered in words ·
invited counts everyone, "· n declined", grey remainder on the bar · the two website switch-offs.

## 3. Tests against your baseline (229 failed / 901 passed / 1130)
- New: 13 backend tests (`item4-campaigns-sets`) and 12 mobile tests (`item4Brand`), all passing.
  Whole mobile suite **441 / 441**.
- Rule drift handled: 14 older backend suites built sets without a posting date or mode (27 payloads);
  they were given both. One older assertion changed: a published campaign can now be renamed (mockup C11).
  Two failures in the campaigns suite were already failing on the baseline and are unrelated (a 403 from
  quota middleware, and a budget field that has been derived since an earlier item).
- Backend whole suite, first run after item 4: **231 failed / 912 passed / 1143** — the two new failures against the baseline (229 / 901 / 1130) were both in `item2-settings-api`, whose set helper sent a Store Visit set with no posting date and no branch; that is rule drift, the helper now sends both, and the suite re-runs 22 / 22. Confirming full run: **229 failed / 914 passed / 1143 total** (47 failed / 64 passed / 111 suites) — the same 229 failures as the baseline, 0 new failures, 14 new tests all passing (13 item 4 + 1 renamed).

## 4. The 26 checks
| # | Check | Result |
|---|---|---|
| 1 | Empty state and create from it | Pass (render test) |
| 2 | Name-only campaign; 201-char description refused with the exact message | Pass (API + render) |
| 3 | Set with name, Aim, mode, date; branch required for Store Visit, none for Remote | Pass (API + render) |
| 4 | Picker greys out days before the seven-day mark; cutoff = date − 3 | Pass (render + client/server constant test) |
| 5 | Too-early date sent straight to the API refused | Pass (API) |
| 6 | Draft set edit/delete; campaign delete while all drafts | Pass (API + render) |
| 7 | After the first invitation the four fields are refused and shown locked; rename works | Pass (API + render) |
| 8 | Set with invitations undeletable, and its campaign | Pass (API) |
| 9 | Counts right on campaign card, set card, set detail | Pass (API + render) |
| 10 | Cutoff, nobody signed: set expires, open invitations close | Pass (job test) |
| 11 | Cutoff, one signed: set stays live | Pass (job test) |
| 12 | Expired and completed leave Live, appear under Past / past sets | Pass (API + render) |
| 13 | Date-passed draft warns; invite refused by the API | Pass (API + render) |
| 14 | Duplicate copies Aim, mode, branch; no creators, invitations, agreements | Pass (API + render) |
| 15 | Campaign started from a group shows the group; the link is stored for item 5 | Pass (API + render) |
| 16 | Another brand's campaign, set, duplicate → 404 | Pass (API; old endpoints stay 403) |
| 17 | Creators never receive descriptions or draft sets | Pass (API) |
| 18 | Loading, empty, couldn't-load with Try again | Pass (render) |
| 19 | Websites still work against the new rules | Pass: no website screen writes a set; both edited pages parse; the two switch-offs done |
| 20 | No new backend failures against the baseline | See §3 |
| 21 | Declined shown on the line; bar leaves grey space | Pass (render + unit) |
| 22 | Declined in Set A can be invited to Set B; live cannot | Pass (API) |
| 23 | Deleting a set with any invitation refused readably; no contract destroyed | Pass (API) |
| 24 | Deleting a branch a set names refused readably | Pass (API) |
| 25 | Website invite button and branch editor show their messages; nothing else changed | Done (parse-checked; please glance at both pages after the push) |
| 26 | Duplicate copies channels and branch, recomputes the rollup, never a duplicate name | Pass (API) |

## 5. How to try it on your phone (after the OTA)
1. Campaigns tab → empty state → New campaign → name only → Next: add a set.
2. New set: try Save with nothing chosen and read the five messages; pick Store Visit and see the branch
   row; open the date picker and see the greyed days and "Invitations would close …"; save.
3. Campaign detail: the set card, Add another set, the ⋯ menu (Rename, Edit description, Delete).
4. Set detail: Edit set, Duplicate (name pre-filled "(copy)", new date), Delete with the confirm text.
5. To see a live set: an invitation has to exist. Until item 5 that means the website's older path is
   off too, so a live set can only be seen on data that already has invitations. The four practice
   campaigns in production have five sets with invitations; they will read as Live with their counts.

## 6. Left open
- **Completed** is a stand-in (all creator rows terminal). A Pay for Sale set cannot reach it until the
  §19 completion rule writes `completed` for commission-only work.
- **One production brand's main branch has no city.** Its Store Visit sets will fail item 2's eligibility
  check until the city is set from the app's Branches screen.
- **Phone screenshots** were not possible (no device attached). Every state is pinned by a render test.
- The website's Campaign Command Center still reads the legacy posting window for phone-built sets; it
  shows blank windows for them, as it did before this item.
