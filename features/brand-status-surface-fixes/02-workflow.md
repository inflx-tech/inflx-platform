# 02 — Workflow

## W1 — New brand signs up and sees its own status

1. Phone → OTP → register form → submit.
2. Lands on `/dashboard`.
3. **Predicted:** the yellow "Account under review" banner renders in
   the layout **and** on the dashboard home.
4. **Today:** no banner in any state — the page looks fully normal
   to an unapproved brand.

## W2 — Admin approves, brand refreshes

1. Admin approves from `/admin/approvals`.
2. Brand reloads `/dashboard`.
3. **Predicted:** banner gone; Influencers and Campaign-create
   become reachable.
4. Requires S1 — before it, the banner was never keyed off a real
   value, so approval could not visibly clear anything.

## W3 — Cold reload with an expired token

1. Brand leaves the tab idle past the 15-minute access-token window,
   then reloads.
2. If `/brands/me` fails:
   - **Predicted:** "Couldn't check your account" with a Retry, and
     a red notice under the dashboard greeting.
   - **Today:** "Account Under Review" (a false statement) and a
     silent nameless greeting.
3. Access stays gated either way — the change is what the brand is
   *told*, not what it can do.

## W4 — Navigation highlight

Visit each of the 11 sub-routes. **Predicted:** exactly one tab
yellow. Dashboard highlights only on `/dashboard` exactly. Settings
highlights across `/settings/profile`, `/billing`, `/subscription`.

## W5 — Signup interrupted

1. Fill the register step, including a Google Maps link.
2. Notice the link is wrong; refresh.
3. **Predicted:** the form returns on the register step with every
   field intact and a "we kept what you had" notice; the Maps link
   is editable. **No new OTP is sent.**
4. **Today:** back to the phone step, all fields lost, and a second
   OTP burned against the 5/hour limit.
5. On successful register the draft is cleared, so a returning user
   is not bounced back into the form.

## W6 — Place search on a cold backend

1. Register step, "Search place", type "kphb".
2. **Predicted:** "Searching… the first lookup can take a few
   seconds", then the dropdown. If it fails: an explicit error with
   Retry plus one-click switches to Maps link / Manual. If it
   genuinely matches nothing: "No places matched".
3. **Today:** silence in every one of those cases.
4. Typing further must not let a slow earlier response overwrite
   newer results (sequence guard).

## W7 — Business type

Industry "Shopping & Retail" → Business type offers exactly one
option, "Fashion — Clothing, Footwear, Jewellery & Accessories",
submitting `category: 'fashion'`. Other industry groups unchanged.

## Verification

- `pnpm qa` green (boots brand-web, so it also catches compile
  errors in these files).
- Manual: founder's end-to-end pass per the standing rule — one
  comprehensive run at the end, not per-slice.
