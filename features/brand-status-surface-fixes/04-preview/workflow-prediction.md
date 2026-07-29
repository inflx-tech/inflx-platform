# 04 — Workflow prediction

Stated before the diff is captured.

## Observable on the dashboard

- A pending brand sees the yellow "Account under review" banner in
  the layout **and** the pending block on the dashboard home. Both
  are new — neither has ever rendered.
- After an admin approval + reload, both disappear.
- Exactly one nav tab is yellow on every route. Dashboard is lit
  only on `/dashboard` itself.

## Observable on failure

Kill the network (or let the access token expire) and reload:

- Dashboard greeting shows a red "we couldn't load your business
  profile" strip with Retry, instead of a silent nameless header.
- Influencers / Campaign-create show "Couldn't check your account"
  with Retry, **not** "Account Under Review".

This is the pair that matters most: the founder was told his
approved account was under review because a failed request was being
reported as a pending status.

## Observable during signup

- Fill the register step, refresh → the form comes back populated,
  on the register step, with a "we kept what you had" notice, and
  **no OTP is sent**.
- Complete registration, revisit `/login` → clean phone step (the
  draft was cleared).
- Business type under Shopping & Retail offers exactly one option.

## Observable in place search

- Typing 3+ characters always produces visible feedback within a
  frame — "Searching…", then results, "No places matched", or an
  error with Retry / Maps link / Manual.
- The 8s cold-start no longer looks like a dead field.

## Explicitly NOT predicted

- Search becoming *fast*. The cold start is a Render property, not
  something this contract changes — it makes the wait legible, not
  shorter.
- Pincode always autofilling. Google returns `pincode: null` for
  many area-level places (verified live for KPHB); the field stays
  `required` and the user completes it.
