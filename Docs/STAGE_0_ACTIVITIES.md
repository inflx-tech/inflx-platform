# Stage 0 — the full list of activities

**Updated 2026-08-20** after your decisions on the wipe, one-number-many-roles, and login codes.
Supersedes the job list in `Docs/STAGE_0.md`.

Stage 0 has **no screens**, so it skips the mockup gate. Its proof is data read back and flows
walked on real phones.

---

## The six jobs

| | Job | State |
|---|---|---|
| **A** | The two missing doorways | ✅ **Done** |
| **B** | Wipe the dummy world | Needs your go |
| **C** | One number, many roles | Ready to build |
| **D** | Login codes: real for real numbers, fixed for test ones | Ready to build |
| **E** | Seed a clean practice world | After B and C |
| **F** | Clear the decks | ✅ **Done** |

---

# A · The two missing doorways ✅ DONE

**What it does.** Two numbers that almost every screen in this programme leans on — *"which of
the six steps is this collaboration on"* and *"how many things need you"* — were built in the
first phase and never connected to anything. Now both apps can ask for them, and both get the
answer from the same place, so your phone and a creator's phone can never disagree.

| | |
|---|---|
| Where it lands | Backend |
| Needs your go | No — already built |
| Proof | 14 checks green, run three times. Measured zero regression against a clean baseline. |

---

# B · Wipe the dummy world — **NEEDS YOUR GO**

**What it does.** Removes every test account and everything hanging off it, so that from the
moment it's done, anyone who signs up is a real person with a real login code.

**Verified before proposing it:** every brand is a test name (`[FTW] Denim Den`, `Aveen Gym`,
`Pizza Boy`, `Pending (3469)`), every follower is `B1 Tester` or `Follower`, and **no money has
ever moved** — every wallet ₹0, no transactions, no withdrawals, no payment references.

### B1 · Take a full backup
Everything that is about to be deleted, written to a file first, so it can be restored.
*(There is precedent — June's wipe wrote one.)*

### B2 · Show you the inventory
Exact counts of what goes and what stays. **Nothing is deleted until you have seen this list
and said go.**

### B3 · Delete the test accounts and their work
Brands, creators, followers, and everything belonging to them — campaigns, sets, agreements,
contracts, shoots, posts, orders, transactions, notifications, requests, pitches.

### B4 · Keep the platform itself
Not user data, so it stays: **4 subscription tiers · 333 product categories · the app settings ·
the negotiation limits · the world rules and sections.**

### B5 · Delete carefully, never bluntly
Row by row in the right order. A blunt cascade would silently take the subscription tiers with
it — a known trap in this database.

### B6 · Read it back
Confirm the accounts are gone **and** the platform settings survived.

| | |
|---|---|
| Where it lands | Database |
| Needs your go | **Yes — twice.** Once for the plan, once after you see the inventory. |
| Reversible | Yes, from the backup |

---

# C · One number, many roles

**What it does.** Today one number is one account. Your number can be a brand *or* a creator *or*
an admin — and if you try the second, the app stops you with *"this phone is registered as
Brand."*

After this, your number can hold a brand account, a creator account, an admin account and a
follower account. Each is separate, with its own approval, its own wallet, its own alerts. The
rule you asked for holds exactly: **one number per role — a brand can never have two numbers.**

**What you'll experience.** Enter your number in the brand app → it asks for business details →
you approve → next time straight to the dashboard. Enter the *same* number in the creator app →
**treated as brand new** → asks for creator details → you approve → next time straight in.

### C1 · Change the rule on the database
A number may appear once **per role** instead of once overall. Safe to do on empty tables,
which is why it comes straight after the wipe.

### C2 · Change the login lookup
From *"find me this number"* to *"find me this number in this role."* **One query.**

### C3 · Handle the ambiguous case
If a number is asked for with no role given, hand back the list of accounts it holds so the
caller can choose, rather than guessing.

### C4 · Checks
Same number registers as brand, then as creator, and gets two separate accounts. Wrong role
still refused. One number cannot be the same role twice.

| | |
|---|---|
| Where it lands | Database · Backend |
| Needs your go | Part of the Stage 0 push |
| App changes | **None.** Every app already sends the role it wants. |

---

# D · Login codes: real for real numbers, fixed for test ones

**What it does.** You need dozens of accounts to test things like sending one invitation to
fifteen creators. You suggested flipping the system to a fixed code when you need that.

That works today because nothing real exists. But the day a real brand signs up, flipping it
means **anyone who knows their number can log in as them.** For a few hours in August that was
in fact true of every account on the platform.

So instead: **a named list of test numbers gets the fixed code. Every other number always gets a
real SMS, whatever any setting says.** You never flip anything, there is never an exposed
window, and bulk testing works exactly as you described.

### D1 · The allowlist
A list of test numbers, editable without an app update.

### D2 · Enforce it
Fixed code for numbers on the list. Real code for everyone else — with no setting able to
override that.

### D3 · Replace the half-finished August change
There is uncommitted work from 18 August that removes the fixed code *entirely* — the opposite
of what you need — and it breaks 4 test suites. This replaces it and fixes those.

### D4 · Checks
A test number gets the fixed code. A real number never does. No setting can change that.

| | |
|---|---|
| Where it lands | Backend · Database |
| Needs your go | Part of the Stage 0 push |

---

# E · Seed a clean practice world

**What it does.** After the wipe the system is empty. This puts back enough for you to actually
test Stage 1 onward — and because it's the only data now, nothing needs hiding.

### E1 · Your accounts
**8639448121 as superadmin**, created directly so you can get in immediately with a real code.
You then add employees as admins from the dashboard yourself.

### E2 · The practice cast
About 22 creators across Vijayawada, Guntur, Nellore and Hyderabad with realistic follower
counts and niches, plus 3 brands. **All on allow-listed test numbers**, so you can log in as any
of them when a test needs it.

### E3 · Work in progress at every stage
2 saved groups · 6 agreements at different ages including one expiring in 9 days · 2 campaigns,
one selling and one paying a fee · shoots at several points including one with a missing parcel
item · posts live, in review, and sent back for a fix.

### E4 · Money that traces
About 30 sales, each linked to a creator, a campaign and a post — some confirmed, some still in
the return window. **This is what makes the earnings screens testable**; today the platform has
never recorded a single attributed sale.

### E5 · Removable in one command
Everything tagged, so the practice world can be cleared without touching real sign-ups.

| | |
|---|---|
| Where it lands | Database |
| Needs your go | Yes — same go as the wipe |

---

# F · Clear the decks ✅ DONE

Dead shoppable-reels plan removed *(it turned out nothing was ever created — a folder of paper)*
· four records corrected that claimed "not released" about live work · the test-account notes
rewritten to match reality.

---

# The order, and where your go is needed

| | Step | Your go? |
|---|---|---|
| 1 | Build C and D, with their checks | No |
| 2 | Build the backup and the inventory | No |
| 3 | **Show you the inventory** | — |
| 4 | Back up, then wipe | **YES** |
| 5 | Apply the one-number-many-roles rule | with the push |
| 6 | Push the server changes | **YES** |
| 7 | Create your superadmin account | with the push |
| 8 | Seed the practice world | with the wipe go |
| 9 | Walk it on real phones and report | — |

**Steps 1–3 need nothing from you. I'm starting there now.**

---

# How you'll know Stage 0 worked

1. You log in at the admin dashboard with **8639448121** and a real code from a real SMS.
2. You enter that same number in the **brand app** — it asks for business details, as a new
   account should.
3. You enter it in the **creator app** — it asks again, as a new account, exactly as you said it
   should.
4. You open the practice brand and find campaigns running, shoots mid-flight, posts live.
5. You open the practice creator and find **a collaboration at each of the six steps, and an
   earnings screen with real money in it.**

Today every one of those is either impossible or empty.
