# 02 — Workflow: landing page restyle + public legal surface

Success = each workflow below executes to its stated end state. "It
rendered" is not success.

## W1 — Visitor reads the landing page on the brand palette

1. Visitor opens `https://inflx.in/`.
2. Page renders on **white ground with yellow accent** — the same
   `#FFFFFF` / `#0A0A0A` / `#FFC107` system already live on `/login`
   and `/dashboard`. No `#070b16` panel survives anywhere on the route.
3. Visitor scrolls: what INFLX is → how it works → what each of the
   three sides gets (brand / creator / follower) → business types →
   apps.
4. Visitor reaches the **Trust & Responsibility** band and sees, in
   plain language, who is responsible for what: creator content, brand
   products, payments, feature availability, AI assistance.

**End state:** a visitor who has never heard of INFLX can state what the
platform does, which of the three sides they are, and who carries
liability for a product they might buy — without opening a legal page.

## W2 — Visitor finds a specific policy from the footer

1. Visitor scrolls to the footer on **any** public route.
2. Footer shows the legal-entity identity block (Omnara India Private
   Limited + registered address + CIN + contact) and grouped policy
   links.
3. Visitor clicks any one of the ten policy links.
4. A real route renders: title, effective date, last-updated date,
   readable body, and the same footer.

**End state:** every policy named in the footer resolves to a real page.
Zero `href="#"` remains on the public surface. No link 404s.

## W3 — Aggrieved user reaches the Grievance Officer

1. User (any role — brand, creator, follower, or a non-user complaining
   about content) opens `inflx.in/legal/grievance`, reachable from the
   footer of every page and from every policy page.
2. Page states the Grievance Officer's name, designation, email, postal
   address, and the statutory response timelines.
3. Page explains the escalation path and what information to include.

**End state:** the disclosure required of an intermediary is published
at a stable public URL, reachable in one click from anywhere on the
site, with no login.

## W4 — User requests account + data deletion

1. User opens `inflx.in/account-deletion` (linked from the footer, and
   the URL submitted to the Play Console data-safety form).
2. Page states which account types can be deleted, exactly what data is
   erased, what is retained and for how long, and why retention applies
   (tax, ledger, dispute).
3. Page gives the in-app path **and** the email fallback for users who
   have already uninstalled.

**End state:** a user who cannot open the app can still initiate
deletion from a public web page — the app-store requirement is met by a
page that works without authentication.

## W5 — Rights owner reports infringement

1. Rights owner opens `inflx.in/legal/copyright`.
2. Page states what a valid notice must contain, where to send it, the
   acknowledgement and action timelines, and the counter-notice route
   for the creator whose content was removed.

**End state:** a takedown request arrives with the information needed to
act on it, and the accused creator has a stated way to respond.

## W6 — Creator or brand checks their own obligations before signing up

1. Prospective creator clicks **Creator Agreement**; prospective brand
   clicks **Brand Agreement**.
2. Each reads terms written for their side — commission, disclosure
   duty, content ownership, payout, TDS for the creator; listing
   accuracy, fulfilment, pricing, campaign funding and escrow for the
   brand.
3. **Advertising & Sponsored Content Disclosure** spells out the
   labelling rules a creator must follow on their own social posts.

**End state:** each side can read the terms that bind *them* without
reading the other side's, and the disclosure duty is stated before the
first campaign, not after a complaint.

## W7 — Search engine and app-store reviewer crawl the surface

1. Crawler requests each legal route unauthenticated.
2. `middleware.js` does not match `/legal/*` or `/account-deletion`, so
   no redirect fires and no session cookie is required.
3. Each route returns 200 with server-rendered text and its own
   `<title>` + `<meta name="description">`.

**End state:** every policy is publicly crawlable and linkable; an app
store reviewer can verify the privacy policy and deletion URL without
credentials.

## W8 — Nobody ships an unfilled legal placeholder

1. Developer builds or a reviewer opens any legal route while the
   founder-supplied facts (CIN, registered address, Grievance Officer)
   are still unset.
2. Every unfilled value renders as a visibly marked placeholder, not as
   plausible-looking invented text.
3. A QA workflow asserts that no placeholder token survives when the
   contract is flipped to released.

**End state:** it is impossible to publish a fabricated CIN or a
fictional Grievance Officer by accident. Missing facts are loud.
