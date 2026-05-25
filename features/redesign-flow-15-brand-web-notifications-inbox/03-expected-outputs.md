# Flow 15 · expected outputs

## State 1 · Notifications
- Count chip `{N} unread · {M} total` (yellow when unread>0, ink otherwise)
- Outfit H1 + yellow rule + sub
- "Mark all read" yellow button (only when unread > 0)
- Row cards: type-colored avatar emoji + Outfit title + mono body + relative date + yellow dot if unread
- Unread cards: yellow-50 bg + yellow-pale border
- Empty: yellow-pale gradient with 🔔 icon + "No notifications yet"

## State 2 · Inbox · Applications
- Count chip `{N} items waiting`
- Sub-tabs INK pills with mono counts
- Tab desc mono caption
- Rich application cards: tier pill + handle + camp meta + stats line + niche + View Profile + Reject/Approve buttons

## State 3 · Inbox · Negotiations / Reviews
- Click-to-navigate compact row cards
- Mono fees + relative dates + danger expires-at + chevron

## State 4 · Inbox · Signatures / Failures
- Info cards with palette left-border + emoji avatar + Outfit title + count chip + body copy
- success/warn/danger variants for left-border accent

## Cross-state invariants
- All scoped under `.ntf` or `.ibx`
- All numbers in JetBrains Mono
- All hover re-asserts color; all disabled locks bg+color
- URL-driven tabs preserved
- Suspense wrapper preserved for useSearchParams
- alert/confirm preserved for mutations
