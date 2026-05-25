# Flow 16 · expected outputs

5 states map 1:1 to `04-preview/mockups/web.html`:

## State 1 · Meals Setup
- Count chip "{N} offers · {S} suggested"
- INK 2-tab pills with mono counts
- AI suggestions yellow-pale panel + "Generate" ink button
- Party-size chips with mono counts (excluding suggested)
- Suggested offer cards (purple-pale tag) + active offer cards (success-bordered)
- Create-by-chat box: yellow-dashed border + ink chat thread + ink Build button
- Sidebar: DiscountClock editor (clock-row inputs + add-step yellow-dashed + Save ink) + Limits card

## State 2 · Meals Today
- 4 mono stat tiles (Pending attn yellow / Today / Upcoming / Meals to Cook)
- INK progress card with yellow gradient fill
- Incoming orders mono table with status pills + Mark delivered action
- Sidebar: Kitchen prep mono counts + Unmatched requests

## State 3 · Orders
- Flow 11 Conversions Orders pattern (INK hero · channel chips · status filter · row cards)
- Sub text notes "See also /conversions for a combined view"

## State 4 · Bookings
- 4 mono stat tiles (Pending attn / Today / Upcoming / Revenue 7d green)
- INK 5-tab pills with mono counts
- Date-badge booking cards (66px square Outfit day + JBM month + time)
- Pending cards: yellow status pill + Confirm ink+yellow + Reject danger inline
- Other cards: confirmed/cancelled tag at right

## State 5 · Enquiries
- 5-chip status filter (submitted/responded/converted/closed) — drops dead new/contacted
- Compact row cards with 💬 Enquiry badge
- Inline expand with form_data kv grid + Send response yellow + Mark Converted ink+yellow
- Converted rows: deal_value mono in amount column
- Sub text notes "See also /conversions"

## Cross-state invariants
- All scoped under .ml/.ord/.bk/.enq wrappers
- All numbers/dates/amounts/IDs in JetBrains Mono
- All hovers re-assert color · all disabled states lock bg+color
- alert/confirm dialogs preserved (out of scope to modal-ify)
- AI restaurant-chat thread preserved verbatim
