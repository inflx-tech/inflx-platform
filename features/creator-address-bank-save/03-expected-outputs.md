# Expected Outputs — delivery address, bank details, Save

## A · Her delivery address
| # | Observable output | How it is verified |
|---|---|---|
| A1 | With none kept, the form starts from her name, login number and profile state/city | API test + screen test |
| A2 | She saves, reads back, changes — there is only ever one | API test (one row) |
| A3 | Checked like a Remote address, in the same words (name, number, street ≤ 190, pincode, state, city of that state, note ≤ 200); nothing half-saved | API test, every message |
| A4 | She can remove it; the screen asks first | API test + screen test |
| A5 | Hers alone: a brand is refused (403), another creator sees none, signed-out is refused (401); it is not on `GET /influencers/me` nor on the profile a brand opens | API test |
| A6 | The Remote form's `prefill` is the kept address, whole, with `fromProfile: true` | API test + screen test |
| A7 | With none kept: name, number, profile city, `fromProfile: false`, no street or pincode | API test |
| A8 | Changed for one parcel: the brand gets the changed one; her profile keeps its own; changing the profile later does not change what was sent; the tick never overwrites a kept address | API test (creator read + brand read) |
| A9 | The tick fills an empty profile; unticked it does not; an address the courier refuses is not kept either | API test |
| P1 | Profile: the row is second, reads what it is for or "City · pincode", never the street, never a red dot; a server without the route leaves the profile loading | screen test |
| P2 | The screen: who-sees-it line, Save grey until something is typed, red lines only once started, one save call, then Profile with "Saved." | screen test |
| R3 | Remote form: filled + blue line + courier answer without touching the pincode; no tick when she keeps one; tick ticked when she keeps none; a correction untouched; an older server's prefill shows the form as it was | screen test |

## B · Her bank account
| # | Observable output | How it is verified |
|---|---|---|
| K1 | All five parts save together; the number is encrypted; none of the five is sent back | API test (row + response bodies) |
| K2 | The number typed twice must agree; missing second typing is refused; spaces do not make them differ | API test |
| K3 | Every part is asked for with its own line; over 80 characters refused; the old two-part entry is refused and saves nothing | API test |
| K4 | A new entry replaces the old whole; saving a bio leaves the bank entry alone | API test |
| K5 | UPI and PAN save as before and do not touch the bank entry | API test |
| K6 | INFLX's list shows the account-holder name, IFSC, bank, branch; the full number only on the one request | API test |
| K7 | A request keeps the details it was made with after she changes them | API test |
| K8 | An account saved before this still withdraws, under her profile name, with no bank or branch; a UPI request carries no bank | API test |
| W1 | Six boxes in order; the first number hidden, the second not, and not pasteable; each empty box its own line; mismatch under the second; saved whole; UPI and PAN unchanged | screen test |

## C · Save
| # | Observable output | How it is verified |
|---|---|---|
| S1 | Change something, tap Save → the screen is gone and "Discard changes?" was never shown | jest on the REAL native stack, 7 screens |
| S2 | Change something, go Back → "Discard changes?"; the screen stays | same |
| S3 | Discard → the screen leaves | same |
| S4 | Nothing changed, go Back → leaves, asks nothing | same |

S1 was red on all six live screens before the fix.

## Regression gates
- `Packages/Mobile`: the whole jest suite, all passing (was 123 suites / 2,922 tests).
- `backend`: the whole jest suite against the last recorded run — zero newly failing.
- Item 11's own suites (`item11-remote-flow`, `item11-phase2a`, `item11-remote-return`), item 17's
  (`item17-wallet`) and `registration-profile` pass unchanged.

## Visual evidence required
- The founder's walk on his phone: Profile › Delivery address; a Remote collab's address form; Wallet
  › Payment details › Bank account; Save on Profile info.
