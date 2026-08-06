# 01 — Spec: Legal sections in the three mobile apps

## Why

The public legal surface went live on inflx.in, but the apps had no way to
reach it. Google Play expects the privacy policy and the account-deletion
route to be reachable **from inside the app**, and a user who wants to know
how a refund works should not have to go and find the website.

The founder's instruction was explicit about the shape:

> "some we add to brand app, some to influencer and some to follower. we dont
> keep all in all apps. say follower is like general public needs only his
> required things not all things, some common for all, some required for only
> that particular actor."

## The rule

**A person sees the documents that bind them.** Showing a shopper the Creator
Agreement does not make INFLX more transparent — it buries the refund policy
they actually opened the screen to find.

| | Brand | Creator | Follower |
|---|:--:|:--:|:--:|
| Terms of Use, Privacy, Community Guidelines, Grievance, Delete My Account, Contact | yes | yes | yes |
| Brand Agreement | yes | — | — |
| Creator Agreement | — | yes | — |
| Advertising Disclosure · Content & IP · Copyright | yes | yes | — |
| Refund & Cancellation · How Ranking Works | yes | — | yes |
| **Total** | **12** | **10** | **8** |

Two judgement calls. **Advertising Disclosure is in the brand app**, because a
brand is responsible for its creators labelling paid posts, not just the
creator. **Refunds is in the brand app**, because brands have to honour them.

The **Cookie Policy is web-only** — cookies are a browser concern and app
tracking is covered by the Privacy Policy, so it would waste a slot in three
mobile menus. Every app links "All legal documents" to inflx.in/legal, so
nothing is unreachable; it is just not in the way.

## Scope

**In scope**

- `src/legal/content.js`, **generated** from brand-web by a script.
- Two screens: a list, and a document renderer.
- One entry row in each app's profile screen, and route registration in the
  three navigators.
- A QA workflow that fails if the generated file drifts from the web source.

**Explicitly out of scope**

- The agency flavour. It shares the codebase but was not in the founder's
  list; it has no Legal entry, and that is a recorded gap rather than an
  oversight.
- Editing any legal text — that belongs to `features/landing-legal-surface/`.
- In-app account deletion, ticketing, and Return / Report-a-problem. The
  documents were deliberately worded around their absence.

## Surfaces touched

- `Packages/Mobile` only — brand, influencer and follower flavours.
- No backend, no migration, no API.

## Non-functional

- **Metro cannot resolve outside `Packages/Mobile/`** — the same constraint
  that forces `src/components/InflxMark.js` to duplicate the shared mark, and
  that is documented in `src/utils/tracking.js`. So the legal text is
  *generated* into the package rather than imported, and a QA workflow guards
  the copy against drift.
- **Company tokens are resolved at build time.** The app receives finished
  strings and knows nothing about `company.js`. A change to a company fact is
  a resync plus an OTA, not a code change in three apps.
- **A duplicate `Stack.Screen` name crashes native-stack on tab mount.** Each
  route is registered exactly once per navigator, verified by grep.
- The screens make **no network call**, so Legal works signed-out and offline.
