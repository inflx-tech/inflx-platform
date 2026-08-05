# 01 — Spec: landing page restyle + public legal surface

## Why

Two problems, one route family.

**1. The landing page is the last dark surface in brand-web.** `/login`
and `/dashboard` were reskinned to white + yellow (`#FFFFFF` ground,
`#0A0A0A` ink, `#FFC107` accent). `app/page.js` still renders on
`#070b16` with an orange→gold gradient. A visitor who signs up crosses
a hard visual seam into what looks like a different company's product.

**2. INFLX has no public legal surface at all.** The footer carries four
links — About, Privacy, Terms, Contact — and **all four are
`href="#"`**. There is no privacy policy, no terms, no grievance
officer, and no account-deletion page anywhere in the repo. `grep` for
`Omnara|grievance|CIN|GSTIN` across the whole tree returns nothing.

That second point is not a polish gap. INFLX takes money, holds wallets,
settles commissions and hosts third-party content, and it does so as an
Indian intermediary. Several of the missing pages are legally mandated
disclosures, and one is an app-store blocker.

## What the law actually requires (researched, not assumed)

Sources were read to primary text where reachable. Items marked
⚠️ are secondary-sourced and are flagged again in `05-impact.md`.

| Instrument | Status | What it forces onto the website |
|---|---|---|
| **IT (Intermediary Guidelines) Rules 2021, Rule 3** — **as amended by G.S.R. 120(E), in force 20 Feb 2026** | Mandated | Prominently publish rules & regulations, privacy policy and user agreement; publish **Grievance Officer name, contact and complaint mechanism** on the home page *or one click from it*; carry the Rule 3(1)(b) prohibited-content list in the T&Cs |
| **…the 2026 timelines** | Mandated | **Acknowledge ≤ 24h. Resolve ≤ 7 days.** **36h** for prohibited-content removal requests. **2h** for intimate-image, nudity, sexual-conduct or impersonation/morphed-image complaints. **3h** to act on a valid legal order. Removed content preserved **180 days** |
| **…Rule 3(2)(c)** | Mandated | A real complaint **intake mechanism** that captures the necessary details — a form, not merely an email address |
| **…Rule 3(1)(c) / 3(1)(f)** | Mandated | **Quarterly** notice of termination rights, personal liability for unlawful content, and mandatory offence reporting. **Annual** notice of the policies and any change |
| **…Rule 3(3) — synthetically generated information** | Mandated, in force **20 Feb 2026** | Binds **every** intermediary, not only large ones. AI-generated or AI-altered audio/visual content must be **prominently labelled**, with no feature offered to strip the label |
| **IT Rules 2021, Rule 3A** | Mandated | Grievance Appellate Committee escalation, appeal within **30 days**. Not a display duty; publishing it completes the ladder |
| **Consumer Protection (E-Commerce) Rules 2020, r.4(2)** | Mandated | Display legal entity name, **registered office + all branch addresses**, website details, and contact details — **email, landline and mobile** |
| **…r.4(4)–(5)** | Mandated | Grievance mechanism + officer **name, contact, designation**; ack ≤ 48h, redress ≤ 1 month |
| **…r.4(7) / r.4(8) / r.4(9)** | Mandated | National Consumer Helpline integration; no cancellation charge unless borne; **explicit affirmative consent, no pre-ticked boxes** |
| **…r.5(3)** | Mandated | Seller identity, **complaint ticket number**, return/refund/warranty/delivery terms, payment-method and chargeback details |
| **…ranking transparency** | ⚠️ **Contested** | One reading places a duty to publish the main ranking parameters in the notified 2020 Rules; another says it sits only in the **2021 draft amendments, never notified**. Resolved by publishing the page **without claiming it is legally required** — correct under either reading |
| **CCPA Misleading Ads & Endorsements 2022, cl.13–14** | Mandated | Endorser due diligence + material-connection disclosure. Penalties under CPA 2019 s.21: **₹10L / ₹50L repeat / endorsement ban up to 1–3 yrs** |
| **ASCI Influencer Guidelines (rev. Apr 2025)** | Self-regulatory, escalates to MIB | Closed list of **ten** permitted labels incl. **“Affiliate”**; upfront and prominent; **never buried in hashtags**, never bio-only; video-duration and live-stream rules; **duty sits on advertiser *and* creator** |
| **CCPA Dark Patterns Guidelines 2023** | Mandated | 13 named patterns. Drip pricing, basket sneaking and subscription traps are UI constraints, not display duties |
| **DPDP Act 2023 + Rules 2025** | Mandated, **enforceable ~12 May 2027** | Consent notice, rights mechanism, published grievance SLA ≤ 90 days, Rule 9 contact person. **Under-18: tracking, behavioural monitoring and targeted advertising are absolutely prohibited and parental consent does not cure it** |
| **IT Act s.43A + SPDI Rules 2011** | Mandated **today** | The operative privacy law until DPDP Phase 3. Already requires a published privacy policy and a designated grievance officer |
| **Google Play** | Store policy | A **publicly reachable, unauthenticated account-deletion URL** |
| **Income-tax Act, 2025** (replaced the 1961 Act on **1 Apr 2026**) + GST | Mandated | Operational, **not** a display duty. The entire `194-` series is repealed — **no document cites a section number or a rate.** Stated contractually in the Creator Agreement as “at the rate required by law” |

Two deliberate non-findings, recorded so nobody re-derives them:

- **Rule 4 SSMI obligations do not apply.** Chief Compliance Officer,
  Nodal Contact Person, Resident Grievance Officer and monthly
  compliance reports attach above **50 lakh registered users**. INFLX
  owes Rule 3 baseline diligence only.
- **No DPO is required.** A Data Protection Officer attaches only to a
  Significant Data Fiduciary, which is a Central Government
  *designation*, not a threshold a company crosses on its own. The DPDP
  obligation INFLX will owe is Rule 9's “business contact of a person
  who can answer processing questions.”

## Scope

**In scope**

- Restyle `app/page.js` to the live white + yellow system. No `#070b16`
  or `#0e1525` panel survives on the route.
- Add a three-sided story to the landing page. It currently sells to
  brands and creators and never explains the **follower/shopper** side,
  which is where the money actually enters.
- A **Trust & Responsibility** band on the landing page carrying the
  founder-supplied notices: creator responsibility, brand
  responsibility, payments, availability, AI, marketplace disclaimer.
- A **shared compliance footer** on every public route: entity identity
  block, grouped policy links, grievance strip, IP notice.
- **Eleven legal documents** as real routes (below).
- **Four support routes**: `/legal` index, `/legal/grievance`,
  `/contact`, `/account-deletion`.
- Every founder-unsupplied fact renders as a **loud placeholder**, and a
  QA workflow fails if one survives to release.

**Explicitly out of scope**

- Legal review. This ships *structure and researched substance*; a
  licensed practitioner signs it off before `released` flips.
- Any change to auth, payments, wallet, campaigns or the API. Zero
  backend files, zero migrations.
- Retro-fitting the Rule 3(1)(b) content list into the mobile signup
  flow, the annual Rule 3(1)(c) notice, the ticket-number surface, and
  DPDP consent UI. All are real obligations; all are **product** work,
  carved to follow-ups in `05-impact.md`, not smuggled in here.
- Multi-language rendering (Eighth Schedule). Recorded as a gap.

## The document set

Ten as the founder specified, plus one the research forced.

| # | Document | Route | Grounded in |
|---|---|---|---|
| 1 | Privacy Policy | `/legal/privacy` | SPDI Rules 2011 today; DPDP-shaped for 2027 |
| 2 | Terms of Service | `/legal/terms` | IT Rule 3(1)(a)+(b) |
| 3 | Creator Agreement | `/legal/creator-agreement` | ASCI 1.5, s.194-O/194R |
| 4 | Brand Agreement | `/legal/brand-agreement` | E-Comm r.5(2), r.6, Dark Patterns |
| 5 | Community Guidelines | `/legal/community-guidelines` | IT Rule 3(1)(b) list |
| 6 | Content & IP Policy | `/legal/content-ip-policy` | Licence grant, ownership |
| 7 | Refund & Cancellation | `/legal/refunds` | E-Comm r.4(8), r.5(3)(c) |
| 8 | Cookie Policy | `/legal/cookies` | Consent, no pre-ticked boxes |
| 9 | Copyright & Takedown | `/legal/copyright` | **IT Act s.79 + IT Rule 3(2)** — *not* DMCA |
| 10 | Advertising & Sponsored Content Disclosure | `/legal/advertising-disclosure` | ASCI + CCPA 2022 |
| **11** | **How Ranking & Recommendations Work** | `/legal/ranking` | Transparency — see below |

**Why #11 exists.** INFLX does not rank incidentally. It has an
admin-controlled section-rules and allocation engine that decides which
products and creators surface, with hand-pick, exclude, brand-scoping
and city overrides. A shopper cannot tell, from the outside, whether a
product is on top because it fits their city or because an admin placed
it there — and a brand cannot tell why its listing is not surfacing.

Whether publishing this is *legally required* is genuinely contested
(see the table above), so the page is written as a company being
straight with its users and **never claims to be a statutory
disclosure**. It is correct under either reading, and it is the one
document on this list that a competitor could not copy, because it
describes machinery only INFLX has.

**On #9's name.** DMCA is United States law and has no application to an
Indian intermediary. The Indian equivalent is the IT Act s.79 safe
harbour read with IT Rule 3(2) takedown timelines and the Copyright Act
1957. The page is named for what actually governs it.

## Surfaces touched

- **App:** `Packages/brand-web` only.
- **Roles:** public / unauthenticated. No gated route is touched.
- **Routing:** `middleware.js` matches only `/`, `/dashboard/:path*`
  and `/admin/:path*`. Every new route falls outside the matcher and is
  therefore public with no session cookie and no edit to middleware.

## Data / contracts

- **Tables / columns / migrations:** none.
- **API endpoints:** none. Every route is static server-rendered content.
- **Money, attribution IDs, status machines:** untouched.

Legal copy lives in one content module keyed by slug, rendered by one
`/legal/[slug]` template — so a policy edit is a data edit, not a
component edit, and every document is structurally identical.

## Non-functional

- **Auth gates:** none, deliberately. An app-store reviewer and a
  search crawler must reach every page unauthenticated. W7 asserts it.
- **Placeholders:** unsupplied facts render via a single `TBD` component
  with a visible dashed treatment. A QA workflow greps the built routes
  and fails if any token survives while `released` is true.
- **Failure modes handled:** a slug that does not exist returns the
  Next.js 404 rather than an empty shell; the footer renders identically
  on every route so no page can be reached that lacks the grievance
  contact.
- **SEO / crawlability:** per-route `<title>` and description; documents
  carry effective and last-updated dates and a version number.
