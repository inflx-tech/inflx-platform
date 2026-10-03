# offer-delete — workflow

## W1 · Delete a draft
1. Listings › Offers. A Draft row shows **Continue** and **Delete**.
2. Delete → "Delete this draft?" → Delete draft.
3. The draft is gone; "Draft deleted."; the Draft count drops by one.

## W2 · Delete an ended offer from the list
1. An Ended row (ended early, or by its date) shows **Open** and **Delete**.
2. Delete → "Delete "{name}"?" → Delete offer.
3. It leaves the list; "Offer deleted."; the Ended count drops by one.
4. Creators who had it still see it in their terms and posts; orders and the wallet still name it.

## W3 · Delete an ended offer from its page
1. The ended offer's page shows **Delete** at the top right.
2. Delete → the same box → Delete offer → back on the Offers list with "Offer deleted."

## W4 · Running offers
1. Scheduled and Live rows show only **Open**; their page shows Add products / Remove products /
   End offer now as today, and no Delete.
2. End offer now → its box now says the offer stays in the list as Ended until you delete it.

## Build path
Founder's message (3 Oct) → survey (`research/survey.md`) → this contract → board → server +
migration 201 file + website → tests → local preview walk → **explicit go** → run-201 on prod →
commit → push (Render + Vercel). No OTA.
