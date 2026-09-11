# item3-discovery-profiles-groups — expected outputs

The 25 phone checks from `PROMPT.md` §12 plus the six the founder added in `APPROVAL.md`. "Proof" names
the automated test that pins the rule; the founder's phone walk is the functional gate.

| # | Check | Expected | Proof (automated) |
|---|---|---|---|
| 1 | Tabs and placeholders | Both apps open on five tabs; each coming-soon tab shows its title/body/button; the button lands on a working screen | mobile `item3Navigators`, `item3Brand › A6` |
| 2 | Business details | 4 MB JPG logo saves; 6 MB PNG → "Upload a JPG or PNG under 5 MB."; 201-char About can't be saved ("Keep it under 200 characters.") | backend `item3-profile › A2` |
| 3 | Sub-categories reminder | Brand with none sees the orange reminder on A1 and the error on A3; can't save with none | mobile `item3Brand › A1`, backend `item3-profile` |
| 4 | City auto-add | New city → added once with `source='google'` + toast; second brand → no toast, no duplicate | backend `item3-branches › create resolves…` |
| 5 | Main branch | Can't be removed (exact message); make-main moves the chip; users.city follows | backend `item3-branches` |
| 6 | Creator profile | City via Google; numbers read-only with "Updated {d Mon}"; no save without a niche | backend `item3-profile › A8`; mobile `item3Creator › A7` |
| 7 | Discover statuses | Approved + OK by default and count = list; toggle off → "Not taking invitations"; blocked-the-brand looks identical to paused; Women-only creator vs Watches brand → "Not open to your brand" | backend `item3-discover › D1`; mobile `item3Brand › D1` |
| 8 | Filters | IG 10K+, ER 2%+, city Hyderabad narrow correctly; "Show N" = list; Clear all resets | backend `item3-discover › D2` |
| 9 | Search | "@priya" finds the handle; "Sharma" the name | backend `item3-discover › search` |
| 10 | Privacy in API responses | Discover and creator profile: no email/phone/visit cities/categories/minimums/blocks. Brand overview: no address/GSTIN/phone/contact/offers | backend `item3-discover`, `item3-brand-overview`, `item3-privacy` |
| 11 | Worked with | Both signatures only; unsigned handshake absent; counts and dates right | backend `item3-worked-with › W1` |
| 12 | Collaborations with you | Only this brand's both-signed rows on P2 | backend `item3-worked-with › P2` |
| 13 | Group names | "Diwali shortlist" ok; "diwali shortlist" duplicate; 41 chars rejected | backend `item3-groups › G3` |
| 14 | Adding in bulk | Existing members ticked and greyed; 101st refused with the message | backend `item3-groups › cap`; mobile select mode |
| 15 | Adding from card or profile | ＋ on a card and Add to group on P1 open G6; profile shows "In your groups: …"; untick removes | backend `item3-groups › for-creator`; mobile `item3Brand › P2` |
| 16 | Remove, rename, delete | Work; `campaign_influencers`, `contracts`, `influencer_proposals` unchanged | backend `item3-groups › remove…delete` |
| 17 | Group privacy | Other brand → 404; nothing creator-facing mentions groups | backend `item3-groups › per brand`; discovery/profile responses carry `groups` only to the owning brand |
| 18 | Live counts | Member pauses → "open to invitations" drops by one on next load | backend `item3-groups › openCount` |
| 19 | Group placeholders | "Invite to a set" / "New campaign" show their toasts, create nothing | mobile `BrandGroupDetailScreen` (toast copy in `copy3.js`) |
| 20 | Find brands | Defaults to pitchable; paused → "Not accepting"; mismatch → "You don't match"; filters + A–Z + Most products | backend `item3-find-brands`; mobile `item3Creator › F2` |
| 21 | Brand overview + product detail | Published products only, list price, out-of-stock rule, no offers; detail read-only, unavailable sizes struck, no buy | backend `item3-brand-overview › O3`; mobile `item3Creator › O1` |
| 22 | Brand's own overview | "This is what creators see.", Edit details, Pitch settings, no Pitch or ⋯ | `BrandOwnOverviewScreen` |
| 23 | States and retry | Loading / empty / couldn't-load with Try again on Discover, Worked with, Groups, group detail, Find brands, both profiles | shared `Skeleton`/`LoadErrorList`/`EmptyState`; mobile empty-state tests |
| 24 | Removed accounts | Rejected creator disappears from every group | backend `item3-groups › rejected` |
| 25 | Tests | No new backend failures vs the after-fix baseline | `06-diff/notes.md` table |
| 26 | Shopper store privacy | No `branches`, phones or addresses in the public store response | backend `item3-privacy › 2` |
| 27 | Suspended vs rejected | Suspended hidden but kept, back on reinstate; rejected rows deleted | backend `item3-groups › suspended`, `rejected` |
| 28 | Test factory | Fixed (fashion + sub-category); three baseline numbers reported | `06-diff/notes.md` |
| 29 | States | 36 states/UTs in the picker; Delhi resolves without adding a state; `STATE_UNKNOWN` adds nothing | backend `item3-branches › alias`, `unknown` |
| 30 | P1 signed count | "{N} collaborations signed on INFLX", hidden at 0; P2 both-signed only | backend `item3-worked-with › P1`; mobile `item3Brand › P1` |
| 31 | Blocked by you | Chip in Discover, in groups and on the profile | backend `item3-discover`; mobile `item3Brand › D1, P3` |

## Exact messages (server and app, `PROMPT.md` §7)
Enter your brand name. · Enter a contact person. · Keep it under 200 characters. · Upload a JPG or PNG
under 5 MB. · Pick at least one sub-category. · Enter a branch name. · Search and pick your branch
address. · The main branch can't be removed. Make another branch the main one first. · Enter your full
name. · Keep it under 150 characters. · Search and pick your city. · Pick your niche to save. · Enter a
group name. · Keep it under 40 characters. · You already have a group with this name. · {Group} is full
(100 creators). Remove someone or use another group. · We couldn't match this address to a state. Try a
nearby address. · {City} is new on INFLX. We've added it to the city list.
