# Workflow Definition — delivery address, bank details, Save

## Actors
A creator in the INFLX Creator app. A brand owner in the brand app (Save only). An INFLX admin
with Money.

## A · Her delivery address
**Preconditions:** signed in. Approval is not needed to keep an address.

1. Profile → second row, **Delivery address**, reading "Where brands send products for a Remote
   collab".
2. She taps it → **Delivery address**: two lines saying what it is for and that only she sees it;
   her name, login number, state and city already filled from her profile; House and street,
   Pincode and Delivery note empty. Save is grey.
3. She types the street and pincode → Save turns yellow. An empty or wrong box has its red line.
4. **Save** → back on Profile, "Saved.", and the row now reads her city and pincode.
5. She opens it again → her address, with **Remove this address** under it. Removing asks first.
6. A brand she has signed a **Remote** collab with is waiting for her address. She opens "Where
   should they send it?" → the whole address is there, under a blue line "Filled in from your
   profile. Change anything for this parcel — your profile stays as it is." The courier answer for
   her pincode is already showing.
7. She changes the street for this parcel, **Review and send**, **Send it** → the brand gets the
   changed address. Her profile still holds her own.
8. A creator who keeps no address opens the same form → as today, plus a ticked box "Keep this
   address in my profile for next time". Sent with the tick on → her profile now holds it. Unticked
   → it does not.

## B · Her bank account
1. Wallet → Payment details → **Bank account** ("Name, account number, IFSC, bank and branch").
2. Six boxes: Account holder name · Account number (hidden as typed) · Re-enter account number ·
   IFSC · Bank name · Branch.
3. **Save** with a box empty → that box says what is missing. With the two numbers different →
   "The two account numbers don't match." under the second. Nothing is saved.
4. All six filled, numbers the same → saved, back to Payment details, "Saved.", Bank account "Added".
5. She asks to withdraw to her bank → INFLX's Money › Withdrawals shows the request "to" the name on
   the account; "Mark processed" lists Account, IFSC, **Bank**, **Branch**.

## C · Save
1. On Profile info she changes her email and taps **Save** → the screen closes, Profile shows
   "Saved.". No box.
2. She changes something and presses **Back** instead → "Discard changes?" · Keep editing / Discard,
   as before.
3. The same on Niche & languages and Delivery address (creator), and Business details, Links, What
   you sell and Add/Edit branch (brand).

## Success definition
She types her address once and every Remote collab after that starts from it. INFLX has what it
needs to pay a bank withdrawal without asking her. Save needs one tap.

## Failure / edge workflows
- A kept address whose pincode the sending store's courier cannot reach → the Remote form says so
  under the pincode, as today; she types another for that parcel.
- A correction after a parcel came back → street and pincode start empty, as today; no tick.
- A creator with a bank account saved before this → "Added", and she can withdraw. INFLX sees her
  profile name and no bank or branch for that request.
- Save refused by the server → the screen stays, the red line is under the box, nothing asks to
  discard.
