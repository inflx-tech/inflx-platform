# 06 — Before / after

## Before

- `/` rendered on `#070b16` with an orange→gold gradient, the last dark
  surface in brand-web while `/login` and `/dashboard` were already white
  and yellow.
- The footer carried four links — About, Privacy, Terms, Contact — and
  **all four were `href="#"`**.
- No privacy policy, no terms, no grievance officer, no account-deletion
  page existed anywhere in the repo. `grep` for
  `Omnara|grievance|CIN|GSTIN` across the tree returned nothing.
- The landing page sold to brands and creators and never explained the
  shopper side, which is where money enters the platform.
- Root metadata was `title: 'INFLX Brand'` — what search engines and link
  previews showed for the whole public site.

## After

- `/` on the live white + yellow system. No `#070b16` or `#0e1525` panel
  survives on the route.
- 16 public routes: 11 legal documents, a legal hub, grievance redressal
  with a working intake form, account deletion, and contact.
- Every footer link resolves. Zero `href="#"` remains except the two
  app-store buttons, which have no store listing yet.
- A shopper section, and a seven-card Trust & Responsibility band.

## Verified, with evidence

| Claim | Evidence |
|---|---|
| Everything compiles | `next build` — all 11 slugs prerendered via `generateStaticParams` |
| Every route serves | HTTP sweep of all 16 routes: 200. `/legal/does-not-exist`: **404** |
| Public without a session | The sweep ran over `curl` with **no cookie**, and the QA spec clears cookies before each navigation |
| Documents are well-formed | Schema validator over all 11: 7–11 sections each, 21–48 blocks, only the four permitted block keys, rectangular tables |
| No superseded citation | `grep` for `15 days`, `72 hours`, `194-O/R/H`, `equalisation` across `lib/legal/`: **no matches** |
| No invented identity value | `grep` for CIN-shaped, GSTIN-shaped and `+91` patterns: **no matches**. All 12 tokens present and unresolved |
| Placeholders render loud | `/legal/privacy` renders `data-tbd` markers; `/legal` shows the "not yet in force" banner |
| Zero regression | `pnpm qa` **GREEN — 98/98 passed, gate 0** (was 79 before; +19 added here) |

## Anti-fake-green

The new W8 workflow was mutation-checked, and **the first version failed
the check**. It searched the rendered text for token names, and passed
against a build where placeholder rendering had been deliberately broken —
because `CIN` and `GSTIN` also appear as ordinary label text in the
footer. It was a false green.

Fixed by stamping `data-tbd` on each placeholder and asserting on the
element rather than on page text, plus asserting that each placeholder
renders **visible** text and names a token that is genuinely still
missing. Re-run against the same broken build, it now fails with
`the placeholder for CIN renders no visible text`. Mutation reverted;
`diff` against the pre-mutation backup confirms only the intended
`data-tbd` addition remains.

## Not verified

- **Legal accuracy.** No practitioner has reviewed the documents. This is
  the reason `released` stays `false`.
- **Founder visual review.** The founder chose the palette, scope and
  placeholder strategy in chat but has not looked at the rendered pages.
  The mockup screenshots could not be captured — the browser pane was
  contended by concurrent research agents and `screenshot` timed out
  repeatedly. Verification was done instead against the **real
  implementation** via page-text extraction, an HTTP sweep and Playwright,
  which is stronger evidence than a mockup render.
- **The in-app deletion path** the account-deletion page instructs users
  to follow (`Profile → Settings → Delete account`) has not been confirmed
  to exist in the mobile app. Flagged in the go-live checklist.
