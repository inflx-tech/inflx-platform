# Workflow

## W1 · Reproduce
Creator app as **Asha M.** (`7900000110` / `000000`) → **Collabs → Invitations** → open a
brand request → tap **counter**.

**Before:** the app closes.
**After:** the counter form opens, pre-filled with the brand's own terms.

## W2 · The counter still means what it meant
- Change nothing, try to send → *"Adjust at least one term to counter."*
- Change the commission → the brand sees **old → new**, that term only
- A term marked **Requirement** stays locked
- Remote with the shipping question unanswered → *"Say whether you want them to send you products."*

## W3 · The guard
`importsResolve.test.js` passes on the fixed tree and **fails** on the broken one. Proven by
reverting, running, and restoring.

## W4 · Regression
Mobile suite green. Bundle builds. `qa/unit` unchanged — this is a mobile-only fix.
