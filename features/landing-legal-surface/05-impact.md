# 05 — Impact

**Verdict: additive and presentation-only. Zero functional disturbance —
no backend, no migration, no API, no auth, no money path. One existing
route changes appearance; everything else is new files.**

## Blast radius

| Area | Impact |
|---|---|
| `backend/**` | **None.** Not a file touched. |
| Migrations / schema | **None.** |
| API surface | **None.** Every new route is static content. No `lib/api.js` call is added. |
| Auth / RBAC | **None.** No new route is gated, deliberately. |
| Routing / middleware | **None.** `middleware.js` matches `/`, `/dashboard/:path*`, `/admin/:path*`. Every new route falls outside the matcher, so it is public by default with no edit. |
| Money / wallet / escrow / commission | **None.** Documents *describe* these rules; they do not touch the code that implements them. |
| Mobile | **None.** brand-web only. No OTA. |
| Existing web routes | `/` restyled. `/login`, `/dashboard/**`, `/admin/**`, `/rejected`, `/waiting` untouched. |
| Bundle | Legal copy is data imported only by `/legal/**`, `/contact` and `/account-deletion` — statically rendered, so it does not enter the landing-page bundle. The landing page gets **lighter**: the dark gradient stack goes, `SiteFooter` is shared. |
| Dependencies | **None added.** |

## Compatibility

`app/page.js` keeps its public behaviour exactly: the same session probe,
the same two roles that get a "go to" link, the same `/login` routing on
every CTA. Only markup and colour changed. `Logo` is called with
`tone="dark"` now instead of `tone="light"` — the documented way to put
the wordmark on a light ground, not a new prop.

## Risks and how each is handled

1. **Publishing a wrong legal fact.** The worst outcome here is not a
   blank page, it is a plausible-looking false statement — a fabricated
   CIN in a published document is a misrepresentation. Handled by making
   invention structurally impossible: documents cannot contain a literal
   identity value, only a token, and an unfilled token renders red.

2. **Publishing a superseded rule.** Most of the Indian web still quotes
   the pre-2026 grievance timelines, so a drafter working from ordinary
   sources would have written them. Handled by pinning the corrected
   figures in the drafting brief and grepping for the old ones.

3. **Citing repealed tax law.** The `194-` series died with the 1961 Act
   on 1 Apr 2026. Handled by banning section numbers and rates outright
   and writing "at the rate required by law" instead — which also
   survives the next amendment.

4. **A contested obligation stated as settled.** Sources conflict on
   whether ranking transparency is mandatory. Handled by publishing the
   page on its merits and never claiming it is required.

5. **The grievance form looking like it works when it does not.** There
   is no complaints endpoint. Building a form that POSTs nowhere would
   silently drop complaints — the worst possible failure for this page.
   Handled by composing a structured complaint and handing off by email,
   with a visible preview of exactly what will be sent.

6. **Legal accuracy generally.** This ships researched structure and
   substance, not legal advice. `released` stays `false` until a licensed
   practitioner reviews it. That is recorded in `lock.json`, not left to
   memory.

## Deliberately carved out — real obligations this contract does NOT close

These were found during research. Each is product work, not content
work, and smuggling them in here would make an unreviewable change.

| Gap | What it needs |
|---|---|
| **Rule 3(3) — AI content labelling.** In force 20 Feb 2026 and binds **every** intermediary, not only large ones. Where a platform lets users publish AI-generated or AI-altered imagery or video, that content must be labelled and the label must not be strippable. | Upload-time declaration flag, a rendered label, and provenance metadata that survives the image pipeline. ⚠️ The existing crop-to-frame uploader is exactly the kind of processing that strips metadata. |
| **Rule 3(1)(c) — quarterly user notice.** New in 2026, replaced the annual one. Must state termination rights, the user's personal liability for unlawful content, and mandatory offence reporting. | A scheduled in-app or email notice. Cheap, and universally forgotten. |
| **Rule 3(2)(b) — the two-hour clock.** Reports of intimate imagery or impersonation must be acted on within two hours. | A 24×7 reachable intake and escalation path. This page publishes the promise; an ops rota has to keep it. |
| **Complaint ticket numbers.** The page promises a reference number on acknowledgement. | A complaints table and a real intake endpoint. |
| **Consent UI.** Explicit affirmative consent, no pre-ticked boxes. | Signup and checkout flows. |
| **Dark patterns.** Thirteen named practices, with live enforcement. Drip pricing and basket sneaking are the ones a commerce checkout trips. | Show the full price up front; no pre-ticked add-ons; any urgency string must be backed by a real persisted field. |
| **Under-18 personalisation ban.** Absolute, and parental consent does not cure it. The ranking document states ranking is never personalised for under-18s — that has to be **true** in the allocation engine. | An age gate that actually gates, and a personalisation bypass for minor accounts. |
| **Multi-language.** Policies must be available in English or a language of the user's choice. | Content pipeline. Currently English only. |
| **Payments licensing.** Independently flagged as the highest-severity open question: whether the wallet, escrow and withdrawal flow needs a payment-aggregator authorisation. | A named professional's opinion, before that flow scales. Not a content fix. |

## Release classification

**Production-impacting, web only.** `git push` deploys `Packages/brand-web`
to Vercel. No backend, no migration, no OTA, no APK. Explicit founder go
required before push, per the standing carve-out.
