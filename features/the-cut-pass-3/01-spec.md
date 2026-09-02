# Pass 3 — disconnect the server

Fourth pass of `Docs/THE_CUT.md`. Delete the server code for everything removed in
pass 1, now that nothing asks for it.

**The data is deliberately untouched.** That is pass 4, kept separate because it is the
only irreversible step in the whole plan.

## What went

Seven route files and seven controllers, plus their mounts and two endpoints wired
directly into the admin and brand routers:

- agencies · referrals (public and admin) · enquiries · meals
- the pre-agreement handshake · creator lookbooks

2,224 lines.

## Why the order mattered

Every endpoint was re-checked for callers in **both** the phone apps **and** the website
before removal — a check that only became meaningful once the website was cleaned.

An hour before this pass, the website still called **19 meals endpoints, 16 referral
endpoints and 7 handshake endpoints.** Running this pass first would have broken the live
site. That is the outside-in rule — screens, then engine, then memory — and it caught a
mistake I had already made by leaving the website out of pass 1.

## How it was verified

Not by parsing files. `require('./src/app.js')` loads the **entire application** — every
route, every controller, every service they depend on. If any of the 14 deleted files
were still referenced anywhere, that throws.
