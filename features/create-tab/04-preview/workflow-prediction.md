# Workflow Prediction — Create tab

Mockup: `mockups/create-tab-ia.html` (Create column + 5-tab bar).

## Predicted observable behaviour
1. 5-tab bar: Home · Collabs · Create · Earnings · Profile.
2. Create tab = IG-clean header + ink "New Post" CTA + My Posts ledger with status
   dot+label rows.
3. Rejected post shows reason + "Try again"; New Post / Try again open PostComposer.
4. Submitting a post returns to the Create ledger (post now "In review").

## Known mockup-vs-build deltas (expected, not defects)
- The **PostComposer wizard** opened from the CTA is the CURRENT (pre-restyle) screen —
  its IG-clean restyle is a later contract.
- "Try again" opens a **fresh** composer (true prefill edit-and-resubmit needs composer
  edit support — later). The mockup's "Edit & resubmit" is realised as this retry.
- Mockup post rows show "views/saves"; the current `getMyPosts` payload has slides +
  products, so the build shows those.
