# item5-invitations — expected outputs

The 35 checks from `PROMPT.md` §12.1 plus the seven the founder added (`APPROVAL.md` §5.1). "Proof" names
the automated test; nothing is tested end to end until after item 7 (the founder's phone walk is the
functional gate). Backend suite `tests/item5-invitations.test.js`; mobile suites
`screens/brand/__tests__/item5Brand.test.js` (B) and `screens/influencer/__tests__/item5Creator.test.js` (C).

| # | Check | Expected | Proof |
|---|---|---|---|
| 1 | Draft set → Add creators → Discover list with checkboxes | picker opens from the set; select mode | B `I1 — Add creators`; B `I9 · I10 › Add creators opens the picker` |
| 2 | Ineligible creator shows "Can't invite", cannot be selected, reason never shown | `pick.state = ineligible`, label "Not open to this set", checkbox disabled | backend `picking › pickable rows`; B `I1` |
| 3 | Creator live in the set shows "Invited", cannot be selected again | `pick.state = invited`, ticked and locked | same |
| 4 | Declined / expired / withdrawn row can be picked again | `pick.state = ok`, `inSet = dead` | backend `picking › pickable rows`; `after sending › withdraw … invited again` |
| 5 | Group: "{k} of {n} can be invited" with the correct split and labels | counts and the three labels | backend `picking › a group against a set` |
| 6 | Pay for Sale terms save; "categories" with nothing chosen refused with the exact message | 201; "Pick at least one category." | backend `terms validator › Pay for Sale`; `sending › sends n rows`; B `I3` |
| 7 | Pay for Content refuses empty, duplicate type, count outside 1–20 | the three §7 messages | backend `terms validator › Pay for Content`; B `I4` |
| 8 | Hybrid refuses ₹0 | "A Hybrid set needs a fixed fee. It can't be ₹0." | backend `terms validator › Hybrid`; B `I5` |
| 9 | Usage rights on with no place refused | "Choose where the brand can use the content." | backend `terms validator › Pay for Content`; B `I4` |
| 10 | Below minimum warns on the terms screen and on Review and still sends | `warnings: ['BELOW_MIN_COMMISSION']`, 201 | backend `picking › eligibility returns her minimums`; B `I3`, `I8` |
| 11 | "Use these terms for everyone" copies the money terms and never a special offer | draft copied; special offer left alone | B `I4`, `I5` (copy assertions) |
| 12 | A saved offer attaches; the preview shows shopper price and creator earnings | `brand_offer_id` set; `preview-basket` called; "A ₹2,400 Silk saree costs ₹2,040" | backend `sending › Pay for Content terms … special offer`; B `I5` |
| 13 | Editing the saved offer afterwards does not change the sent invitation | snapshot unchanged (12 stays 12) | backend same test |
| 14 | Special offers of three kinds; "applies to" hidden for BOGO; "also save to my offers" creates a library row | library row `active`, config snapshotted; §7 message on a missing amount | backend same test (save-to-library + OFFER_AMOUNT); B sheet built (`SpecialOfferSheet5`) |
| 15 | An offer with a future start date is not applied before it | resolver yields no discount before `offer_valid_from` | backend `offer fixes › Gap B` |
| 16 | A sale records which offer produced it | tracking record carries `brand_offer_id`; the resolver's winner id is written | backend `offer fixes › Gap A` (unit level; no real sale placed) |
| 17 | "Send {n}" creates exactly n rows, notifies n creators, makes the set live | 3 rows, 3 `offer.invited`, `state = live`, `locked = true` | backend `sending › sends n rows`; B `I8` |
| 18 | Sending locks Aim, date, mode, branch | PATCH → 422 `LOCKED` | backend same test |
| 19 | Sending after the cutoff refused with the exact message; the app hides Add creators | "Invitations for this set closed on {date}."; button hidden | backend `sending › set-level refusals`; B `hides Add creators` |
| 20 | A creator who became ineligible is named and nothing is written | 422 with `details.failures`, 0 rows | backend `sending › when one creator cannot be invited` |
| 21 | The set groups creators correctly; the counts line matches item 4 | D6 order; "6 invited · 1 signed · 3 waiting · 1 declined" | backend `after sending › the set groups creators`; B `I9` |
| 22 | Withdraw only before an answer; creator sees Withdrawn, no reason; can be invited again | 200 then 422 with the exact message; `invitation.withdrawn` body has no reason; 201 on re-invite | backend `after sending › withdraw`; B `I10` |
| 23 | Remove works up to both signatures, never after; no contract destroyed | 200 (unsigned draft deleted); 422 after both signatures, contract kept | backend `after sending › remove` |
| 24 | Editing sent terms via the API refused with the exact message | 422 "Terms can't be changed once the invitation is sent…" | backend `after sending › sent terms are never edited` |
| 25 | Invites tab card: Aim, mode, date, money, days left | card fields | backend `the creator › Invites lists the card`; C `I11` |
| 26 | Locked set block then personal block; the street address never shown | order asserted; no address field | backend same (LEAK regex); C `I12` |
| 27 | Pay for Content invitation shows deliverables in words and the 25/25/50 split in rupees | "1 Instagram reel, 2 Instagram stories"; ₹2,000 / ₹2,000 / ₹4,000 | backend `the creator › a Pay for Content invitation`; C `I13` |
| 28 | Accept → accepted on both sides, brand notified, contract drafted | `answered_at`, 1 contract, `offer.accepted` | backend `the creator › accept`; C `Accept confirms` |
| 29 | Decline requires a reason, stores the text, brand sees both | 422 without; notification body carries label + note; set row carries both | backend `the creator › decline`; C `Decline needs a reason` |
| 30 | After the cutoff the three actions disappear; the API refuses all three | `canAnswer false`; "This invitation closed on {date}." | backend `the creator › after the cutoff`; C `after the cutoff` |
| 31 | Counter opens the placeholder and writes nothing | 0 negotiations; navigates to `CounterSoon` | backend same; C `I12` |
| 32 | Another brand's set / invitation / withdraw / remove → 404; another creator's accept / decline → 404 | 404s | backend `sending › nobody picked…`, `after sending › the brand's view`, `the creator › Invites lists…` |
| 33 | No creator response carries the brief, the group, another creator's terms or a warning | LEAK regex on list and detail; legacy endpoints too | backend `the creator › Invites lists the card` (check 42 included) |
| 34 | Loading / empty / couldn't-load on the picker, the set and Invites, Try again works | skeleton, empty copy, `load-error` + Try again | C `empty Invites, and Done`; B (picker uses DiscoverList's states) |
| 35 | Backend tests show no new failures against the baseline | 229 failed / 914 passed / 1143 → see `06-diff/notes.md` | full run + `compare.js` |
| 36 | A deferred creator has her own heading, is not waiting, survives the cutoff | `deferred` group, `waiting` unchanged, job leaves her | backend `after sending › the set groups creators` |
| 37 | The invitation offers Accept, Counter, Decline only; Counter hidden when negotiation is off | no "another date" action; `canCounter false` hides the button | C `Accept confirms…`; backend `the creator › after the cutoff` |
| 38 | A failed batch names the creators, writes nothing, "Remove {n} and send the rest" works | banner + rows marked; second send with the rest | backend `sending › when one creator cannot`; B `I8 › a failed batch` |
| 39 | A legacy row refuses a terms edit because `invited_at` was backfilled | SQL-inserted row + the migration's backfill → 422 | backend `after sending › sent terms are never edited` |
| 40 | The open-group broadcast is unreachable or switched off, and it is stated which | unreachable: no screen sends `influencer_mode`; production has no open-group set | `05-impact.md`; the build summary |
| 41 | A commission above 50% asks once in the app and is accepted by the server | ConfirmSheet once; `validateTerms` accepts 60 and 100 | B `above 50%`; backend `terms validator › Pay for Sale` |
| 42 | The legacy creator inbox and detail no longer return the brief, budgets or coupon prefix | fields absent at any status | backend `the creator › Invites lists the card` |
