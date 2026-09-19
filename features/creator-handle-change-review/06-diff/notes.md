# creator-handle-change-review — before/after notes

**Before:** a Pending Verification row was built on the claimed scraped profile. A creator who
changed her Instagram, or added YouTube, before approval showed the OLD handle large with SCRAPE
PENDING, and her current handles in ten-point grey at the top ("signed up as @…"). Verify approved
the old profile; the current accounts were measured anyway (item 3b saves a pre-approval change
as waiting_approval and approval confirms every current account), but nothing on screen said a
change had happened and the approved record named the old handle.

**After (server):** each queue row carries `current_accounts` and `changed` (old → new per
platform, empty when nothing changed). Verify, inside its transaction, renames the claimed
profile to the creator's current handles; when another scraped profile already carries the new
Instagram handle (it is unique) the record keeps the old one and the response says
`record_renamed: false`. Measurement is unchanged. The incomplete-profile refusal still comes
first.

**After (admin, V1/V2):** the row leads with the current channels, large and linked; the amber
"She changed her channels after signing up" block with each old → new line and the instruction to
check they belong to her; the signup profile's facts underneath, labelled; "Verify & approve".
After Verify, the green line names the channels and says measuring has started. Handle checks
rows use the same old → new line.

_Admin details from the build report — see the build summary in `lock.json`._
