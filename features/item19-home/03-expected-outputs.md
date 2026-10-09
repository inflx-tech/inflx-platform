# item19-home — expected outputs: the checks

Backend `tests/item19-home.test.js` (B, 30 tests — real API, real database, every state reached
through the doors a person uses). Mobile `src/screens/__tests__/home19.test.js` (M, 75 tests — each
screen mounted with the server's real shape, plus the 52-record parity fixture) and the three
navigation suites on the real navigators (N: `tabBarRealNavigator`, `tabBarOnMainPages`,
`pushedScreensHaveBack`). The Home read was also run read-only against the live data for every
brand and creator before deploy (P; see the end).

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | An approved brand and an approved creator open the app on Home. An account not yet approved still gets the Under review Home, its two cards and the Finish-profile sheet, unchanged | N "mounts with the real navigators and opens on its usual tab"; N "a pending creator opens on Home"; M "the Home tab decides: under review, or Home"; the older `registrationProfile` pending tests, untouched | pass |
| 2 | Home shows four sections in the agreed order; each shows at most three rows; each heading and See all opens the agreed place | M "four sections in order, three rows of nine…", "a row opens the exact screen… See all opens the full list", "Money is the Wallet's three lines…"; B "on a real brand… Home shows the first three; the count is the whole list" | pass |
| 3 | Brand: every collaboration the set screen gives a button to appears in Needs you with the same button word, across all campaigns and sets; nothing else from that rule appears | B "these are exactly the rows the set screen puts under Your move"; M parity "brand · …" (26 records) | pass |
| 4 | Creator: every collaboration her Collabs card marks as her move appears in Needs you with the same button word | B "the creator: answer, sign and waiting…"; M parity "creator · …" (26 records) | pass |
| 5 | The moves the row rule misses appear: brand — send a new time, book again, a parcel difference, confirm the return; creator — mark the visit done, correct the address, send the products back | B "on the day of the visit she is asked to mark it; once the time passes the brand is asked for a new one", "a difference gives the brand its own row", "send the products back has a door", "the return reaches the store", "a parcel that came back" | pass |
| 6 | Pay for Sale and Hybrid rows appear on both sides | B "posts owed, a post with INFLX, then the social version and the brand's confirmation", "Hybrid: the brand's confirmation carries her payment" | pass |
| 7 | Sign, Send agreement and Answer are not offered once the cutoff has passed | B "once the cutoff has passed, nothing before the signatures is offered or shown" | pass |
| 8 | A collaboration past its posting date shows Delayed on its row | B "a collaboration past its posting date shows Delayed and comes first"; M "need-2-delayed" | pass |
| 9 | Order: dates in the next three days or Delayed first; then what holds up the other side; then the rest; oldest first inside; a blocking setup row rises | B "dates in the next three days and Delayed first…", "the signature closing in two days is first, a pitch last", "the creator's setup rows… a failed withdrawal rises above them" | pass |
| 10 | Every row's button opens the right screen with the right collaboration, pitch or post | M "every destination the server can name is a screen that exists" (both apps, against the navigators' own screen lists); M the tap tests; N the Home jumps | pass |
| 11 | Count rows match their own lists; the orders row opens the website | B "a new pitch is one row…", "a creator who agreed and needs a set…", "orders to pack is one row that opens the website…"; M "the orders row opens the website" | pass |
| 12 | Creator: "Shoppable post needed" and "A post was sent back" match the Create tab | B "posts owed, a post with INFLX…" (the row replaces the "make your posts" card and carries done / minimum) | pass |
| 13 | Setup rows appear only when true | B "the creator's setup rows appear only when true…", "orders to pack… with sales and no bank account" | pass |
| 14 | Waiting on others holds exactly the rows that carry a tag; group counts add up; no row is in both lists | B "each row is in the right list…" (nothing in both); M "a tag in place of the button, split by who is being waited for" | pass |
| 15 | The three money lines equal the Wallet's own figures and counts to the rupee | B "the money lines are the Wallet's own figures, to the rupee" | pass |
| 16 | Campaigns rows equal the Campaigns tab's Live cards; Running now equals Collabs › Active | B "Campaigns is the Campaigns tab's Live cards; Running now is Collabs › Active" | pass |
| 17 | Nothing needs you: one line, the other sections unchanged. First day: the steps and one yellow button; no empty sections | B "first day: nothing at all…; a quiet day is not a first day"; M BH4, BH5, CH4, CH5 | pass |
| 18 | The Home tab icon shows the Needs-you count from every tab, and the new count after an action | B "the tab count is the list's count…"; N "the Home tab carries the number…", "the navigator feeds that number from the store"; M "the count on the Home tab" | pass |
| 19 | Brand bell: unread count; the list; a tap opens the screen the notice names, for every code the server sends a brand; opening marks all read | M "BH6 — lists them, marks them read, and a tap opens the screen the notice names", "every screen code the server puts on a brand notice has a destination" | pass |
| 20 | Creator notices: the eight kinds that did nothing when tapped open their screens; her Home bell shows the count | M "the creator's notices — the eight kinds…"; M CH1 "the bell opens her notices in Collabs" | pass |
| 21 | The creator's store link shows on her Home and Copy copies it; no line when she has no link | M CH1 (copy), CH4 (no line); B "first day…" (the link itself) | pass |
| 22 | One brand never sees another brand's rows; one creator never sees another's | B "one brand never sees another's rows…" (and the wrong role is refused: 403; no token: 401) | pass |
| 23 | The Home read does not run one query per collaboration | B "the read runs the same number of queries for one collaboration as for five" (and at most 8 for the two lists) | pass |
| 24 | No regression: full backend compare against the baseline shows 0 newly failing; the whole phone suite passes | `scripts/compare-tests.js backend/baseline_item19.json` (HEAD 9fc5fad8, an untouched copy) vs after: 2080 → 2110 tests, 178 failing before and after, **30 new all passing, 0 newly failing, 0 gone**; mobile 120 suites / 2862 tests | pass |
| 25 | **Back returns to Home** after a row is opened (added during the build) | N "a jump made from Home (jumpFromHome)" — four tests on each app's real navigator | pass |

**P — the live data, read-only, 9 Oct 2026 (before deploy).** Every statement checked to be a
SELECT; 1,194 run. 15 brands and 27 creators read with **0 errors**. Brands: 3 × Plan the visit,
1 × orders to pack, 1 × Add your bank account; waiting — 5 her address, 1 not answered, 1 her
posts, 1 final payment, 1 in transit. Creators: 6 × send address, 4 × add payment details,
1 × answer, 1 × make posts, 1 × Instagram needs fixing, 1 × mark the visit; waiting — 4 brand
plans the visit, 1 final payment, 1 courier. Home's count equalled the full list for every account.
