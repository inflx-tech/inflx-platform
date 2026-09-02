# Workflow — pass 0, closing the front door

## The workflow this protects

**A person who owns a business signs up to sell on INFLX.**

That is the very first thing anyone does on the platform, and until now it ended in a
dead end for 34 of the 35 answers they could give.

## Before

1. Owner enters their phone number and the one-time code.
2. Owner picks an **industry** from 7 (website) or 9 (phone) groups.
3. Owner picks a **business type** from up to 30.
4. Owner fills in business name, address and location.
5. Account is created and waits for approval.
6. **If they picked anything but fashion:** they are approved, they build a catalogue,
   and no shopper can ever see it. Nothing at any point told them so.

## After

1. Owner enters their phone number and the one-time code.
2. Owner **reads** the business type — Fashion — and a line saying other kinds of
   business are not supported yet.
3. Owner fills in business name, address and location.
4. Account is created and waits for approval.
5. Anyone who is not a fashion business now finds out **at step 2**, before spending any
   effort.

## The end state this must reach

- A new brand can complete registration and reach the waiting-for-approval screen.
- The form never offers a business type that leads nowhere.
- A request that skips the form is refused by the server, with the same explanation a
  person would have read on the form.
- **The nine brands already registered — one of them a restaurant — can still edit their
  profiles.** This is the condition most likely to be broken by a careless version of
  this change, and it is the one to check first.

## Where it can go wrong

| Risk | What would happen | How it is handled |
|---|---|---|
| The gate is on the forms only | A direct request registers any business type; the cleanup refills behind us | The server is the gate; the forms only decide what is *said* |
| The gate is on registration only | A brand registers as fashion, then switches itself to restaurant from the profile edit | The same check runs on the profile write path |
| The gate is unconditional on profile edit | The existing restaurant is locked out of its own profile | The check fires only when the category field is actually sent |
| A saved signup draft carries an old type | A dead choice reappears in a form that no longer offers it | The draft no longer restores the category |
| A missing style token | The phone app builds cleanly and crashes on launch | Palette read directly; one such token (`P.bgSoft`) was found and fixed before commit |

## Not in this workflow

Removing the restaurant, rental and salon product builders, screens, abilities or data.
Those brands still work exactly as they did. This pass only closes the door — passes 1
to 4 do the removing.
