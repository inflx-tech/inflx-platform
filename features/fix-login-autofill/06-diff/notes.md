# Diff notes — Fix login phone autofill

Founder walkthrough fix. brand-web /login phone input gained autofill-suppression
attributes (autoComplete="off", name="login-phone", autoCorrect/spellCheck off,
data-1p-ignore, data-lpignore) so the browser stops auto-filling a saved number
when the user types. OTP flow unchanged. next build exit 0.

Note: browser-side. The user may also clear saved numbers in Chrome
(Settings → Autofill → Payment/Addresses) to remove the old test entries; the
code change prevents this field from offering them going forward.
