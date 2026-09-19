# change-login-number — workflow prediction

Mockups: `mockups/change-login-number-mockups-v1.html` (N0–N6, locked 19 Sep 2026).

| Screen | Predicted | Built as |
|---|---|---|
| N0 entry | "Change number" beside the locked Phone tile on Business details and Profile info | link on `BrandBusinessDetailsScreen` / `ProfileInfoScreen` → `ChangeNumber` |
| N1 | masked current number, both-phones note, Send code | `shared/ChangeNumberScreen` step 1 → `POST /auth/change-phone/start` |
| N2 | six-box code, resend countdown, Verify | step 2 → `verify-old` |
| N3 | +91 + 10 digits, this-role-only note, Send code; the two refusals inline | step 3 → `send-new` |
| N4 | six-box code, signed-out-everywhere note, Confirm new number | step 4 → `confirm`, tokens stored |
| N5 | back on the detail screen, new number in the tile, green line | route toast |
| N6 | the three refusal wordings | inline error / red note / back-to-step-1 |

Deliberate departures: none.
