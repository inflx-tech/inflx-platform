# Workflow — brand registration on mobile

1. New number → PhoneScreen → OTPScreen (role=brand app) → verify-otp creates
   users row (status pending) → `brandApi.getMe()` 404 → **BrandRegister**.
2. Founder fills: name, business name, industry chip → business-type chip,
   location (search place → autofill + coords badge, all fields editable; or
   types manually), 6-digit pincode.
3. Submit → `POST /brands/register` → brands row created (status pending,
   with lat/lng when search used) → reset to **Waiting** ("under admin
   review" — now TRUE: the business is actually in the queue).
4. Admin approves at /admin/approvals → next app open → status approved →
   `setAppRole('brand')` → brand home.
5. Existing brands (getMe succeeds) routing unchanged: approved → home,
   pending → Waiting, rejected → Rejected.

Expected end state: a brand can complete onboarding end-to-end on mobile
without ever touching the web app; the admin queue shows mobile-registered
brands identically to web-registered ones.
