# 03 — Expected outputs

## Status resolution

`GET /brands/me` → `{ success:true, data:{ brand:{…, user_status },
user_status } }`

Frontend now resolves in this order:

```js
res.data?.user_status || brand?.user_status || brand?.status || null
```

| Account state | Layout banner | Dashboard banner |
|---|---|---|
| pending | "Account under review" (yellow) | pending block |
| approved | none | approved block |
| rejected | rejection notice | rejected block |
| fetch failed | none | red "couldn't load your business profile" + Retry |

Previously **every** row above rendered nothing.

## Gated pages

| `brandStatus` | Heading |
|---|---|
| `'approved'` | page renders |
| `'pending'` | "Account Under Review" |
| `'unknown'` (new) | "Couldn't check your account" + Retry |

`'unknown'` is set only on a failed request. Access remains gated —
only the explanation changes.

## Nav active state

```js
const base = item.match || item.href;
const isActive = base === '/dashboard'
  ? pathname === '/dashboard'
  : pathname === base || pathname.startsWith(base + '/');
```

Exactly one tab active on every route. Settings carries
`match: '/dashboard/settings'` so it covers all three settings
sub-pages.

## Signup draft

`localStorage['inflx_brand_signup_draft']` holds the register-step
fields. Read on mount **only when `inflx_token` exists**; removed on
successful register. Restoring jumps straight to `step: 'register'`
with a visible "we kept what you had" notice — and sends no OTP.

## Place search states

| Condition | Shown |
|---|---|
| < 3 chars | nothing |
| request in flight | "Searching… the first lookup can take a few seconds." |
| 200 + predictions | dropdown (top 5) |
| 200 + empty list | "No places matched…" + switch to Maps link |
| failed / null | "Search isn't responding right now." + Retry / Maps link / Manual |

Out-of-order responses are discarded via a monotonic sequence ref.

## Business type

Industry "Shopping & Retail" → one option, `value: 'fashion'`,
label "Fashion — Clothing, Footwear, Jewellery & Accessories".
Payload `category: 'fashion'`. No schema, no migration.

## Regression bar

`pnpm qa` green.
