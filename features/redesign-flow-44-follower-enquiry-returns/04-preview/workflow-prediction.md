# Flow 44 — Workflow prediction (pre-implementation)

## Enquiry
1. From a store/offer with an enquiry CTA → EnquiryScreen opens with an **ink hero**
   ("Enquire at {brand}" + mono "via @handle").
2. **yellowPale offer strip** shows "ENQUIRING ABOUT" + offer title + ink/yellow
   "% OFF" badge.
3. White form card: Name + Phone **pre-filled** (mono), Email/Message/Preferred-time
   blank. Required fields marked with red *.
4. Tap **ink/yellow "Submit Enquiry"** → validation → on success the screen replaces
   with a **yellow check-tile** "Enquiry Submitted!" + ink/yellow Done.

## My Returns
1. From Me/account → MyReturns opens, ink hero "My Returns" + mono count.
2. Each return = white card: thumb + product/brand + mono "REQUESTED {date}" +
   **status pill** (pale bg + dark text) + reason + (if present) mono refund amount
   in successText + yellowPale "From INFLX" admin-notes.
3. **Pull-to-refresh** (ink tint) reloads; returning to the screen re-fetches.
4. No returns → light empty state (glyph + "No returns yet").

## No behavioural change
Every input, validation, API call, tracking field, and render branch is identical
to today — only colors, fonts, and spacing change.
