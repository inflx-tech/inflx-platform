# Workflow — Stage A

## The order of work

**1 · Migrations 165 + 166** — additive only, dry-run against production first.
*(done — awaiting the go to apply)*

**2 · The set wizard** — `SB-25` aim, `SB-26` basics, `SB-28` who, `SB-29` terms.
The aim reads the existing `campaign_sets.goal`; the basics write the three new
columns.

**3 · `SB-30` her terms** — assembles what already exists on
`campaign_influencers` (commission, fee, all four `alloc_*`, the offer and its
dates) and adds the two new ones (`channels_json`, `formats_json`).

**4 · `SB-23` / `SB-24`** — a campaign becomes two fields; sets become cards on
the campaign.

**5 · `SB-37` publish** — per set, with the shortfall named and a button to fix it.

**6 · `SC-05`** — she reads exactly what he set, with the two things she cannot
change separated out.

**7 · Adjacent fix** — `cancelInfluencer`'s invalid contract status.

## The reading rule everything in this stage obeys

```
her value  ->  else the set's value  ->  else nothing
```

`channels_json` and `formats_json` exist on both levels. A creator row that is
NULL **inherits**, which is what all 8 live rows do. Copying the set's values down
would turn "inherits" into "the brand explicitly chose this", and the brand never
chose it.

The same shape applies to the set's own new columns:

```
go_live_date  ->  else window_start / window_end   (pre-set-first sets)
shoot_mode    ->  else the contract  ->  else the agreement
```

`productionMode.model.js` already implements the second line. Nothing about it
changes; the set simply becomes a new first answer.

## One function, both sides — every time

The recurring fault in this codebase is **two things doing one job**, and it has
cost five shipped bugs. Every rule in this stage is written once and called by
both the app and the server:

| Question | The one answer |
|---|---|
| does this set buy content? | `buysContent(goal)` — exists |
| what can she sell, in words? | `describeAllocation()` — exists |
| which shoot, and starting in what state? | `resolveProductionMode()` — exists |
| which channels apply to her? | **new** — her value, else the set's |
| is the wallet short, and by how much? | **new** — one number, one message |

## What is deliberately NOT in this stage

**Countering.** She can accept or decline. Asking for something different —
money or date — is Stage B, because it needs the negotiation to hang off her set
row (migration 168), which is the largest structural change in the programme.

If she declines here, she declines; nothing is deferred yet.
