# registration-and-profile — spec

Founder decisions in `PROMPT.md` (chat, 18 Sep 2026, three rounds). Seed lists
`backend/seeds/south_cities_draft.csv` (146 rows) and `backend/seeds/languages_draft.csv`
(30 rows), both approved 18 Sep. Mockups not yet drawn — **this spec locks first, mockups
second, build third.**

**Scope: the three phone apps, plus the admin screens.** The live admin is
`Packages/brand-web/app/admin/**` — the same package as the brand website, a different folder.
The boundary is exact: **`app/admin/**` is in scope; `app/dashboard/**` and `app/login/**` are
not.** The brand-facing website is re-skinned later onto the same backend (founder, 18 Sep:
"web site means brand web, not admin web — design admin web along with mobile apps").

## What this delivers

Registration becomes short and always-valid. Everything else moves to the profile, where the
app nags for it. Approval stops being a rubber stamp and starts refusing incomplete accounts.
A pending account gets into the app instead of dying on a Waiting screen. Google Places leaves
address entry entirely, and city and state become two fixed lists that every matching rule in
the platform can actually use.

---

## 1. The address model

### 1.1 The shape

Every address anywhere in the brand and creator apps is now exactly four parts:

| Part | Kind | Required |
|---|---|---|
| Street address | free text | yes |
| Pincode | free text, exactly 6 digits | yes |
| State | picked from a fixed list | yes |
| City | picked from a fixed list, filtered by the chosen state | yes |

Nothing else. No coordinates, no formatted address from a provider, no place id, no map link.

### 1.2 The lists

**States offered: six.** Andhra Pradesh, Telangana, Karnataka, Tamil Nadu, Kerala, Puducherry.

**Cities offered: 146** — every district headquarters of those six states, named as people say
it rather than as the district is named (Ernakulam district appears as *Kochi*, Nilgiris as
*Udhagamandalam*, Dakshina Kannada as *Mangaluru*). Source: `south_cities_draft.csv`.

The picker is two steps and strictly ordered: **choose State, then the city list narrows to
that state.** A city can never be chosen before its state.

### 1.3 The wording that makes 146 enough

The field is not labelled "Your city". It is labelled **"Your nearest major city"**, with a
line beneath it: *the closest big city to you — not your exact town or area.*

This is the whole reason a 146-entry list works and no escape hatch is needed. If the label
says "your city", a creator in a small town is stuck; if it says "nearest major city", she is
not. The label is load-bearing, not decoration.

### 1.4 What happens to what already exists

The roughly 92 cities and 36 states already in `ref_states` / `ref_cities` are **not deleted**.
Rows outside the six southern states stay valid so existing accounts keep resolving and keep
showing their city. They are simply **not offered** in any picker.

Mechanism: an `is_offered` flag on `ref_states`. Pickers read offered states only; every
matching, search and display path keeps reading the whole table. Expansion later is a flag
flip, not a migration.

### 1.5 No escape hatch

There is deliberately no "my city isn't listed". The founder's call. If real drop-off appears
at that screen, that is the signal to revisit — it is not a reason to build it now.

---

## 2. What registration collects

Registration is short, entirely mandatory, and every field validates on the spot. Nothing
optional survives at this step: an optional field at registration is a field that is empty
forever, which is how creator city became empty for everyone who skipped it.

### 2.1 Creator — two screens, five fields

**Screen 1**

| Field | Rule |
|---|---|
| Full name | required, non-empty |
| State | required, from the list |
| Nearest major city | required, from the list, filtered by state |

**Screen 2**

| Field | Rule |
|---|---|
| Instagram handle | at least one of the two |
| YouTube handle | at least one of the two |

**Change from today:** city was optional free text; it is now required and resolved. This is the
single fix that closes the store-visit matching failure at its source.

### 2.2 Brand — one screen, seven fields

| Field | Rule |
|---|---|
| Your name | required |
| Business name | required |
| Sub-categories | required, one or more of the eight fashion categories |
| Street address | required, free text |
| Pincode | required, 6 digits |
| State | required, from the list |
| Nearest major city | required, from the list, filtered by state |

Business type stays stated, not chosen: Fashion.

**Removed from brand registration:** the place-search box, the Google Maps link box, coordinate
capture, and the referral code box.

### 2.3 What the server stops accepting

`POST /brands/register` no longer accepts `latitude`, `longitude`, `locality`,
`formatted_address`, `google_maps_url` or `referral_code`. `city` and `state` arrive as ids
from the reference lists, not as typed names.

`POST /influencers/register` requires `state_id` and `city_id`.

Both registrations resolve to a canonical city row on the way in. **There is no longer any path
that writes an unresolved city name.** That asymmetry — registration typing cities while
everything downstream matched resolved ones — was the root cause of the largest class of
failure in the survey, and this is where it ends.

---

## 3. What the profile collects

### 3.1 Creator profile

| Field | Notes |
|---|---|
| Photo | as today: JPG/PNG, under 5 MB, checked after upload |
| Bio | as today, 150 characters |
| Niche | exactly one from the list, **or `Other` plus a typed description** |
| Languages | one or more from the list of 30 |
| Age | **new** |
| Gender | **new** |
| Email | **new**, collected only — not verified this version |
| Full name | as today |
| State + city | the two pickers, replacing the Google city search |
| Instagram / YouTube | as today, including the re-verification rule when changed after approval |

**Leaves the creator profile:** UPI, bank account, IFSC, PAN. They move to Wallet (§5).

### 3.2 Brand profile

| Field | Notes |
|---|---|
| Logo | as today |
| About | as today, 200 characters |
| Contact person | as today |
| Email | **new**, collected only |
| Sub-categories | as today — already editable, no change |
| Branches | §4 |

**Leaves the brand profile:** GSTIN. It moves to Wallet (§5).

### 3.3 The `Other` niche

Choosing `Other` opens a short free-text box: *what kind of content do you make?*

The typed answer is stored beside the niche and surfaced to admin in a review queue. Admin
either maps her to an existing niche or adds a new niche to the reference list and maps her to
it. **`Other` is how the niche list grows** — it is not a permanent bucket, and a creator does
not stay unmatched in it.

Until an admin resolves it, a creator on `Other` is matched by every rule that does not filter
on niche, and is invisible to niche-filtered search. That is honest and temporary.

### 3.4 Languages

Thirty entries, from `languages_draft.csv`, ordered English → Hindi → the southern languages →
the rest. Sanskrit is deliberately absent. All ten currently-seeded languages are preserved
with identical codes, so no creator's saved languages break.

---

## 4. Branches

Branch add and edit lose the Google address search and take the four-part address of §1.1.

**The main-branch rule:** a brand's first branch is its main branch, created from the
registration address as it is today. **When a brand adds a second branch, it must explicitly
say which of the two is the main one.** Never assumed, never silently kept. From the third
branch onwards the existing make-main action covers it.

---

## 5. The Wallet tab

Everything that is money-identity moves out of the profile and into Wallet, for both sides:

| Creator | Brand |
|---|---|
| Bank account — **account number and IFSC together, one entry** | Bank account — **account number and IFSC together, one entry** |
| UPI id | GSTIN |
| PAN | |

**Bank account number and IFSC are one thing, not two.** They are never shown or asked as
separate rows — one entry, one form, both fields inside it. A bank account without an IFSC is
not a usable payout destination, so splitting them into two list items invites a half-filled
state that is worth nothing to anyone. (Founder, 18 Sep: "we ask all in one tab, no separate
bank account and ifsc code".)

**No format checking is built.** No PAN pattern, no IFSC pattern, no GSTIN length. Founder's
explicit call: the team verifies these by hand, offline. Storage stays encrypted exactly as it
is today.

**This is not required for approval.** A creator is approved without bank details; she cannot
be *paid* without them. A brand is approved without a GSTIN.

---

## 6. Approval — the business process

### 6.1 The journey

```
Register (short, all mandatory, all validated)
    ↓
Lands IN the app. Home screen visible, profile editable.
Any real action → "Your account is under review by admin."
A popup asks them to finish the profile, with the reason:
    "Completing this helps us verify and approve you faster."
    ↓
Profile complete → "Submit for review"
    ↓
Admin reviews
    ↓
Approved → live. For a creator, the number-measurement run starts.
Rejected → remarks shown, plus their own form back, pre-filled and
           editable → they fix it → resubmit
```

The account reaches the admin queue **when the user submits it**, not when they register. A
half-finished signup is no longer a ghost row sitting invisibly in a queue.

### 6.2 Complete means

**Amended 19 Sep 2026 — see `AMENDMENT-2026-09-19-approval-not-completeness.md`: approval never refuses an incomplete profile; the list below is the nag and the admin information, not a gate.**

**Creator:** full name · state · city · at least one social handle · photo · bio · niche (or
`Other` + description) · at least one language · age · gender.

**Brand:** contact name · business name · sub-categories · street · pincode · state · city ·
logo · about · contact person.

**Not required for approval, either side:** bank, UPI, PAN, GSTIN, email verification.

### 6.3 What the server must gain

The brand's action surface is **already gated correctly** — campaigns, creator search, creator
invitations and market analytics all refuse a pending brand with the right words
(`requireApproved`, `ACCOUNT_PENDING`). Nothing to build there.

The creator's action surface is **gated nowhere**. Not one creator route checks approval —
pitches, counters, accepts, declines, invitation replies are all open. Today nobody notices,
because no pending creator can reach the app. **The moment we open that door this becomes
live, so it is closed in the same change**, using the same middleware the brand side already
uses.

### 6.4 Rejection and resubmission

Today: one shared Rejected screen, one button, which calls the **brand** resubmit endpoint —
so a rejected creator is refused outright, because no creator resubmit endpoint exists at all.
And even for a brand it changes nothing: it flips the status back to pending and resends the
identical data the admin just rejected.

Both are replaced. Rejection shows the admin's remarks and returns **the user's own
registration form, pre-filled with everything they typed, fully editable.** They correct it and
resubmit. This needs a creator resubmit path, and the brand's needs to actually accept edits.

### 6.5 Pending users reach the app

After OTP, a pending account enters the main app instead of the Waiting screen. It can see the
home screen and browse the profile tab. Every other action returns the pending message. A
prompt to finish the profile appears, carrying the reason it helps.

The Waiting screen is retired for pending. The Rejected screen stays, rebuilt per §6.4.

---

## 7. Identity wiring

| Fact | Single source, after this |
|---|---|
| Brand's phone | the registered login phone. `brands.phone` is retired as a concept — the payout path reads the login phone instead of the column that was never written |
| Brand's city / state | the main branch, resolved to reference rows |
| Creator's city / state | her profile, resolved to reference rows |
| Contact person | the typed column on the brand row (the website's JSON copy is a website problem, handled when the website is re-skinned) |

---

## 8. The agreement

The agreement gains the brand's GSTIN, the creator's PAN, and both registered addresses, read
from whatever is on file at the moment it is generated.

**When a value is missing, the field prints empty.** There is no gate on campaign creation and
no blocking check. The founder's call: the team collects these before a campaign is created,
and if they did not, the agreement simply shows a blank there.

---

## 9. What is deleted

| Removed | Where |
|---|---|
| Google place search | brand registration, brand branch add/edit, creator profile city |
| Google Maps link paste | brand registration |
| Coordinate capture and storage | brand registration and branches |
| Referral code box | brand registration (website — removed when the website is re-skinned) |
| Payment & Tax section | creator profile (moves to Wallet) |
| GSTIN field | brand business details (moves to Wallet) |
| Waiting screen, for pending accounts | both apps |

**Cost of the Google removal: nothing in any live flow.** Verified in the survey — coordinates
are read only by the shopper feed's distance ranking and the meal-radius rules, both dormant
while the follower app is profile-only. Store visits use the typed visit address. The agreement
uses city and state.

---

## 9A. Admin — what it must gain

The approval process of §6 cannot run without admin, and admin lives on the web. Three screens.

### 9A.1 The brand review list is corrected, not created

`app/admin/brands/[id]` **already builds a missing-fields list**, and it is wrong for the new
model. It currently asks for **GST number** (now Wallet, not approval) and a **map pin** (being
deleted entirely), and it never asks for about, contact person, city, state or sub-categories.

It is rewritten to the §6.2 brand checklist exactly. Nothing more.

### 9A.2 The creator review list is new

`app/admin/influencers/[id]` shows each field with a "Not stated" placeholder but has **no
roll-up**, so an admin has to read the whole page and decide for themselves whether it is
complete. It gains the same kind of list, against the §6.2 creator checklist.

Both lists exist so that a rejection can name what is actually missing — which is the whole
point of §6.4's remarks.

### 9A.3 The `Other` niche queue is new

A screen listing creators who chose `Other`, each with what she typed. Two actions per row:
**map her to an existing niche**, or **add a new niche to the reference list and map her to
it**. This is the mechanism by which §3.3 grows the list; without it, `Other` is a hole rather
than a door.

---

## 10. Explicitly out of scope

- **The follower app's location capture.** Google stays there and is untouched. It positions the
  shopper feed, which is a different job from entering an address, and the founder wants it kept
  and extended later.
- **The brand-facing website** — `app/dashboard/**` and `app/login/**`. Re-skinned afterwards
  onto this same backend. Admin (`app/admin/**`) is **in** scope; see §9A.
- **Email verification.** Collected now; OTP or link next version.
- **Terms-acceptance recording.** Not this version.
- **The referral system.** Parked whole.
- **Format validation of PAN / IFSC / GSTIN / UPI.** Manual, offline, by the team.

---

## 11. Sequence

1. **This spec locks.** ← we are here
2. Mockups drawn from it.
3. Mockups lock.
4. Build.

No app code before step 3.
