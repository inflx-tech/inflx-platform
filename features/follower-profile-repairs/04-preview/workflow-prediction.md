# Workflow prediction — follower-profile-repairs

What a follower will actually experience once these mockups are built, stated
before implementation so the diff has something to be judged against.

## 1. Saving a post stops being a dead end

**Today:** Meera taps the bookmark on a post. `post_saves` gets a row. She goes
to Profile → "Saved posts" and sees a list of restaurant offers. Her post is
not there and never will be.

**After:** the row opens her saved posts, newest save first, two per row, each
card showing the creator and how many products the post carries. Videos are
marked with a play badge. Tapping opens the post. Unsaving removes it from the
list the next time she opens the screen.

**With nothing saved:** "Nothing saved yet · Posts you save will appear here,
so you can come back to them later." Never a spinner, never an error.

## 2. An address can finally be removed

**Today:** Meera has moved. The old flat sits in her list forever; she can edit
it but not remove it, and it keeps appearing in the checkout picker.

**After:** each address row carries a delete action. Tapping it raises a confirm
sheet naming the address, with a red **Delete address** and a plain **Cancel**.
Confirming removes it from the list and from checkout.

**What deliberately does not change:** the order she had delivered to that flat
last year still shows that flat as its shipping address. The delete is soft —
`follower_orders.address_id` points at the row, and rewriting history to make a
delete look tidy would be a lie about where a parcel went.

**If she deletes her default:** another address becomes the default
automatically. Checkout is never left pointing at a deleted row.

## 3. Her name can be corrected

**Today:** "Edit" raises "Coming with the account settings slice", and the
server has no route to change anything even if the button worked.

**After:** Edit opens a form with **Name** and **Email**. Phone is shown
read-only with a plain explanation ("Your phone is how you sign in, so it can't
be changed here"). Saving updates the header immediately and survives a restart.

**When the email is taken:** an inline red line under the field — "That email is
already in use". Not a crash, not a silent failure, not a generic toast.

## Predicted non-effects

- Guests see **no change at all**: all three surfaces are signed-in only, and
  the guest Profile card keeps its current two working rows.
- No pricing, order, commission or wallet behaviour changes.
- The legacy saved-offers screen stays on disk, simply no longer reachable from
  Profile (zero-baggage rule — its removal is a separate cleanup contract).

## What would count as a failed diff

- A deleted address reappearing anywhere in checkout.
- A past order failing to render its shipping address.
- Saved posts showing offers, or showing posts the follower never saved.
- A duplicate email producing a 500, a silent no-op, or a generic error.
