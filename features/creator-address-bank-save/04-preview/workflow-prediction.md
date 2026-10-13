# Workflow prediction — delivery address, bank details, Save

What a creator will see and do on the boards of `mockups/creator-address-bank-save.html`.

## 1 · Delivery address (P1, P2, P3, R3a, R3b)
1. Profile has a second row, **Delivery address** — "Where brands send products for a Remote collab".
2. The screen opens with her name, login number, state and city already there. She types the street
   and pincode, optionally a landmark, and taps Save. Back on Profile the row reads "Guntur · 522002".
3. Next Remote collab: "Where should they send it?" is already filled, with a blue line saying it
   came from her profile and the green courier line already showing. She adds her sizes, Review and
   send.
4. If she is at her mother's that month she changes the street on that form. The brand gets that
   one; her profile is untouched.
5. A creator who never opened the profile screen sees the old form with one extra ticked line —
   "Keep this address in my profile for next time".

## 2 · Bank account (W1, AM3)
1. Wallet › Payment details › Bank account now asks six things. The first number box shows dots.
2. A slip in the second typing is caught on Save: "The two account numbers don't match."
3. INFLX, paying her withdrawal, reads the name on the account, the bank and the branch in the same
   box as the number and IFSC.

## 3 · Save (S1, S2)
One tap on Save closes the screen with "Saved.". The "Discard changes?" box appears only on Back
with something unsaved.

**What changes versus today**
| | Today | After |
|---|---|---|
| Street address for a Remote collab | typed from nothing each time | kept once, arrives filled |
| Where INFLX holds a creator's street address | only inside a collab she sent it to | also in her profile, seen by her alone |
| Bank account | number + IFSC, typed once | name, number twice, IFSC, bank, branch |
| "Pay to" name INFLX sees | her profile name | the name on the account |
| Save on a profile screen | Save → box → Keep editing → Save | Save |

**Predicted questions**
- "Can a brand see my address?" → Only one you send it for a collab, as today.
- "I changed the address on the parcel form — did my profile change?" → No.
- "I changed my profile address — will the parcel already booked go to the new one?" → No; a sent
  address is locked, as today.
- "Why do I type the account number twice?" → INFLX pays by hand; one wrong digit sends your money
  to someone else.
- "I saved my bank account last month — do I have to do it again?" → No. The new boxes are asked
  the next time you save bank details.

**Blast radius** — creator app: Profile (one row), one new screen, the Remote address form, the
bank form. Brand app: Save on four screens. INFLX admin: two lines on Money › Withdrawals. Server:
one new address store and three routes; the creator's bank save; the withdrawal request's copy.
No money moves. The brand's own bank form, the shopper app and every other screen are untouched.
