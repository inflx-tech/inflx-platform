# Impact — wizard Next error visibility

**Verdict: admin-web-only bug fix. No backend, no migration, no mobile/OTA.**

- One-line correctness fix to `patch()` restores all wizard validation
  feedback (step-2 Next and step-4 Publish); previously every wizard error
  message was swallowed.
- The red-field cue is purely presentational.
- Zero data or API change; Vercel redeploy on push.
