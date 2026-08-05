# Go-live checklist — what the founder must supply

The legal surface is built and renders. It is **not publishable yet**.
Twelve facts are missing, and every one of them is a legally required
disclosure or a date that a policy is meaningless without.

Nothing is invented anywhere. Each missing value renders as a red dashed
placeholder on the live page, and `/legal` shows a "these documents are
not yet in force" banner until all twelve are filled.

---

## Step 1 — supply the twelve facts

All twelve live in **one file**:
`Packages/brand-web/lib/legal/company.js`

Change `value: null` to the real string. Nothing else needs editing —
every document references these by token.

| # | Token | What to supply | Why it is required |
|---|---|---|---|
| 1 | `CIN` | The Corporate Identity Number from the certificate of incorporation | Official publications of a company must carry the CIN alongside the name and registered office |
| 2 | `GSTIN` | The GST registration number | An e-commerce operator registers compulsorily; buyers and sellers verify the operator against it |
| 3 | `REGISTERED_ADDRESS` | Registered office address, in full, with PIN code | E-Commerce Rules r.4(2). **Also list every branch office** if there is more than one |
| 4 | `GRIEVANCE_OFFICER` | Full name of a real, named person | IT Rules r.3(2)(a). The **name** must be published — "the Grievance Team" does not satisfy it |
| 5 | `GRIEVANCE_DESIGNATION` | Their designation | E-Commerce Rules r.4(4) requires designation in addition to name and contact |
| 6 | `GRIEVANCE_EMAIL` | A dedicated grievance mailbox | Must be monitored against a **24-hour** acknowledgement clock |
| 7 | `SUPPORT_EMAIL` | Customer care email | E-Commerce Rules r.4(2) |
| 8 | `SUPPORT_MOBILE` | Customer care **mobile** number | r.4(2) names mobile explicitly |
| 9 | `SUPPORT_LANDLINE` | Customer care **landline** number | r.4(2) names landline explicitly and separately. **A mobile alone does not satisfy this** |
| 10 | `EFFECTIVE_DATE` | The date the documents take effect | A policy with no effective date cannot be shown to have applied to a past transaction |
| 11 | `JURISDICTION_CITY` | Courts of which city have jurisdiction | Usually the city of the registered office |
| 12 | `ENTITY` | Already filled — *Omnara India Private Limited*. **Confirm it matches the certificate of incorporation exactly**, including "Private Limited" vs "Pvt Ltd" | The name must appear as incorporated |

> **On #4 and #6.** Appointing a Grievance Officer is not a formality.
> Complaints must be acknowledged within **24 hours** and resolved within
> **7 days**, and reports of intimate imagery or impersonation must be
> acted on within **2 hours** — which needs a path that is reachable
> outside office hours. The page publishes those promises. Someone has to
> keep them.

---

## Step 2 — have a practitioner review the documents

Eleven documents are drafted, researched against current Indian law, and
written to be honest rather than defensive. They have **not** been
reviewed by a lawyer. Two areas specifically warrant a professional eye:

- **Creator payout tax treatment.** Whether creator commission is taxed
  as an e-commerce participant payout or as commission depends on how the
  money actually flows, and the two rates differ by roughly twentyfold.
  The documents deliberately state no rate and cite no section, so they
  are safe as written — but the *operational* answer needs a CA.
- **Payments licensing.** Whether the wallet, escrow and withdrawal flow
  requires a payment-aggregator authorisation is the single
  highest-severity open question found during research, and it is a
  licensing question, not a wording question.

---

## Step 3 — things the pages now promise that the product must deliver

These are commitments the published text makes. Each needs product work
to become true; they are carved out of this contract, not forgotten, and
are listed with detail in `05-impact.md`.

| Promise made on the page | What has to exist |
|---|---|
| "We give you a reference number when we acknowledge" | A complaints table and a real intake endpoint. Today the form composes an email. |
| "Acted on within 2 hours" for intimate imagery and impersonation | A 24×7 reachable escalation path |
| "Ranking is never personalised for anyone under 18" | An age gate that actually gates, and a personalisation bypass for minor accounts |
| "Delete account from Profile → Settings → Delete account" | That path must exist in the app. **Verify before publishing** — the page tells users to go there |
| AI-generated content is declared and labelled | Upload-time declaration, a rendered label, and metadata that survives the image pipeline |
| Quarterly notice of termination rights and user liability | A scheduled in-app or email notice |

---

## Step 4 — publish

Once Steps 1 and 2 are done:

1. The `/legal` "not yet in force" banner disappears **by itself** — it
   is driven by `missingTokens()`, so there is nothing to remember to
   turn off.
2. Set `release.released = true` in
   `features/landing-legal-surface/lock.json`, with who and when.
3. `git push` → Vercel deploys brand-web. **Web only** — no backend, no
   migration, no OTA, no APK rebuild.
4. Submit `https://inflx.in/account-deletion` as the account-deletion URL
   in the Play Console data-safety form, and
   `https://inflx.in/legal/privacy` as the privacy policy URL for both
   stores.
