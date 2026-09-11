# item2-pitch-invitation-settings — workflow

## W1 Brand sets who may pitch (B1→B2→B3→B6)
1. Brand opens Profile → Pitch settings. Row shows `{Accepting|Paused} · {Aims} · {modes}` + On/Paused chip.
2. Screen loads defaults (missing row = all open). Save is grey.
3. Brand changes Aims/modes/filters. Client validation mirrors §4; Save enables when clean and dirty.
4. Save → `PUT /v1/brands/me/pitch-settings` → toast "Pitch settings saved."
5. Turning the switch off opens B5; confirm → `accepting:false`; save → grey "Pitches paused" banner, other
   sections dimmed, "Open pitches" row → placeholder.

## W2 Creator sets who may invite (C1→C2→C3→C6)
1. Creator opens My Profile → Invitation settings.
2. Defaults: three Aims, both modes, visit cities = her profile city (if on the list), any category.
3. Selecting categories adds one % row per industry in Pay for Sale and Hybrid; none → one "All industries" row.
4. Save → `PUT /v1/influencers/me/invitation-settings` → toast + "Brands see on your profile" preview.
5. Turning an Aim off hides its card; the numbers come back when it is turned on again.

## W3 Other side looks (X1/X2/X4)
- Creator opens a brand overview → `GET /v1/brands/:id/public` → `pitchSummary`. OK: card + Pitch button.
  NOT_ACCEPTING: banner, button off. NOT_MATCHING: criteria banner, button off.
- Brand opens a creator profile → `GET /v1/influencers/:id` → `inviteSummary`. Same three shapes.

## W4 Block (X3/X4→B7/C6)
- ⋯ → Block → confirm → `POST /blocked-*` → toast with Undo. No notification. Existing rows untouched.
- Blocked list shows name + date + Unblock → `DELETE /blocked-*/:id`.

## W5 Enforced on send (A7)
- `POST /v1/influencers/me/proposals` → admin limits, then `canCreatorPitchBrand(aim, mode)` → 403 with a
  coarse code, or 201.
- `POST /v1/campaigns/:id/sets/:sid/invite` → `canBrandInviteCreator(set, terms)` → 403 with a coarse code,
  or 201 with `eligibility_warnings[]`. Skipped when briefing a handshake agreement.
