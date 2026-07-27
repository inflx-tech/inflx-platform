# Workflow — discovery sliders (step 2b)
## Actor
Approved brand on the influencer directory.
## Steps
1. Open "More filters" → Min/Max followers, Min ER %, Min/Max rate are **sliders** showing
   the current value (e.g. "50k", "3.5%", "₹25,000").
2. Drag a slider → the value updates live and (via step-2 debounce) results re-filter.
3. Drag a slider back to zero → that filter switches off ("Any").
## Success
- Sliders replace the number boxes, show live values, filter results, and switch off at zero.
## Failure/edge
- Rapid dragging → one debounced search after settle.
