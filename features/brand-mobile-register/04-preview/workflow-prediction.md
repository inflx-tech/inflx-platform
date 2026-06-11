# Workflow prediction — brand mobile registration

New brand number → OTP → **BrandRegister** (mockup: brand-register.html):
name + business name + industry chips (10 groups, W1 regrouped) → business-type
chips → location (place-search autofill with ✓ badge, or manual) → state
bottom-sheet picker → Complete registration → Waiting screen.

Predicted API calls: places autocomplete (per keystroke ≥3 chars, debounced
350ms) → place details (on pick) → POST /brands/register (with lat/lng when
search used) → reset to Waiting. Admin queue then shows the business.

Existing-brand paths (approved/pending/rejected) must be byte-identical.
