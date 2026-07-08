# Impact — app-builder-image-content-fixes

**Verdict: unblocks image-fill sections; admin-only; no follower runtime change.**

- Backend: one new admin route (section presign) under the capability the App
  Builder already uses. No change to existing endpoints; master-dishes presign
  untouched.
- brand-web: upload routed to the new endpoint (+ visible errors); name
  optional for banner designs (auto-filled hidden label — backend still gets a
  title, so save/validation unchanged); per-design image size/format guidance.
- No follower app change, no OTA. The phone already hides absent titles and
  loads the public media URL.
- Production-impacting: Render (backend) + Vercel (brand-web) on push.
- Rollback: revert one commit; the master-dishes presign path still exists.
