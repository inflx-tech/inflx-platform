# Feature Spec — Brand-web auth (phone → OTP)

> Reference contract. The implementation already exists; this folder
> demonstrates the full contract → test → report loop on a real flow.

## Problem / goal
A brand user must authenticate on brand-web to reach the dashboard.
First leg of that workflow: submit phone number → receive/enter OTP.

## Scope
- In scope: the `phone` → `otp` step transition on `/login`.
- Out of scope: OTP verification, registration, dashboard routing
  (separate workflow contracts).

## Surfaces touched
- App: brand-web (Next 14, port 3002)
- Role: prospective/returning brand (unauthenticated)

## Data / contracts
- API: `POST /v1/auth/send-otp` `{ phone }` → `{ success, data }`
- No DB/migration changes.

## Non-functional
- Send-OTP button disabled until a 10-digit number is entered.
- Failure mode: API failure keeps user on the phone step with an error.
