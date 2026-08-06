# 02 — Workflow

Success = each workflow reaches its stated end state. "It rendered" is not
success.

## W1 — A shopper reads the refund policy without leaving the app

1. Follower app → **Profile** → **Legal & policies**.
2. The list shows **8** documents in two groups: for everyone, and buying on
   INFLX.
3. Tap **Refund & Cancellation Policy**. The document renders, with its tables
   as stacked cards.

**End state:** the shopper learns the return window without opening a browser,
and never sees the Creator Agreement.

## W2 — A creator checks their disclosure duty

1. Creator app → **Profile** → **Legal & Policies**.
2. **10** documents. The creator group holds the Creator Agreement,
   Advertising Disclosure, Content & IP and Copyright.
3. Tap **Advertising Disclosure**. The labelling rules render.

**End state:** the duty that actually gets creators fined is two taps from
their profile, and no refund policy they cannot action is in the way.

## W3 — A brand finds what it is responsible for

1. Brand app → **Profile** → **Legal & Policies**.
2. **12** documents — the widest set, because a brand is both a seller and an
   advertiser.

**End state:** a brand can see both halves of its role in one place.

## W4 — Any user reaches the full set

1. From any Legal list, tap **All legal documents**.
2. inflx.in/legal opens in the browser with all 14.

**End state:** nothing is hidden. The app is curated, not censored.

## W5 — A link inside a document resolves

1. Open a document that links to another policy.
2. If that document ships in this app, it opens **in the app**.
3. If it does not — the Cookie Policy, say — it opens **on the website**.

**End state:** no dead end, in either direction.

## W6 — The text cannot silently go stale

1. Someone edits a policy in brand-web and does not resync.
2. `pnpm qa` runs the generator in `--check` mode, which re-renders in memory
   and compares.
3. The suite **fails**, naming the fix command.

**End state:** the website and three apps cannot serve different versions of
the same policy without the suite noticing. This is the workflow that makes
generating the file safer than hand-copying it.

## W7 — Nothing crashes on mount

1. Each app opens its Legal list, then every document in it.
2. Every route name is registered exactly once per navigator.

**End state:** no duplicate-route crash on tab mount — the known native-stack
failure mode — and no malformed block takes a screen down in a user's hands.
