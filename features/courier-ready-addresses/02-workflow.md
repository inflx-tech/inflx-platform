# Workflow Definition — Courier-ready addresses

> Step 3. Each numbered step becomes an assertion.

## Actor
A brand owner (registering, or signed in and approved), and a creator on a Remote collaboration.

## Preconditions
The offered states and cities exist. For steps 6–8: a signed Remote collaboration, the creator's
address sent, at least one product line saved, money in the brand's wallet.

## Workflow steps (user-observable)
1. A new brand types "Benz Circle, Vijayawada" as its street address → refused: "Add the shop or
   door number. Couriers need it to find the store." Nothing is created.
2. It types "Shop 4, MG Road, Benz Circle" → registered; its Main Branch carries that address.
3. On Edit branch the brand sees Street address (with the courier hint and a 140 counter),
   Landmark, Pincode, State, **City**, Store phone (already holding its login number).
4. It adds a landmark and a different store phone and saves → both come back on the branch.
5. A branch that has never had a store phone saved (every branch that exists today, and any
   saved from an older app) → the courier is given the login number.
6. A brand whose branch reads "Guntur, Andhra Pradesh, India" opens Book the parcel → that branch
   is greyed, saying "Needs a shop or door number". Pricing or booking it anyway is refused:
   "Add the shop or door number to Main Branch first — the courier needs it to find the store…"
7. The brand fixes the branch and books → the courier is given: the brand's name with the branch
   name as the contact, the store phone, the street, the landmark as a second line; and the
   label's sender is the brand.
8. The creator's return is addressed to the brand's name at that street and landmark, with the
   store phone.
9. A creator types a 191-character street → refused; 190 is accepted.

## Success definition
Every refusal above is a sentence that says what to type; every accepted address reaches the
courier in the shape its reference requires; nothing that worked for a complete address before
behaves differently.

## Failure / edge workflows
- A street that is only a pincode's digits ("MG Road 520010") → still "Add the shop or door number".
- A 141-character street → "Keep the address under 140 characters."
- A landmark of 46 characters → "Keep the landmark under 45 characters."
- A store phone that is not a 10-digit mobile → "Enter a 10-digit mobile number."
- An old branch saved from the website's profile page with its bad address unchanged and only the
  business name edited → saved (the address was not sent, so it was not re-judged).
