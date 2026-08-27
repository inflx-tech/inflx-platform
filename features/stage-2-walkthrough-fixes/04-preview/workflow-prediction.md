# Batch A — workflow prediction

Written **before** implementation so `06-diff/` has something to be measured against.

| Step | Prediction | What I predict goes wrong first |
|---|---|---|
| W1 · commission set | Three fields and a button | **The channels section may look bare.** With min-channels and both explanatory lines gone, two chips sit under a heading with nothing around them. It may need the heading trimmed too |
| W1 · creators | One sentence replaces the chip | **This is the judgement call.** If the sentence reads as noise he will want it gone; if it reads as useful, keeping it was right. Only he can say |
| W1 · terms | Save works with no offer | — |
| W2 · content set | **Identical to before** | **The highest-risk step in the batch.** Every removal sits inside a `selling`/`buyingContent` branch, and getting one branch wrong silently strips a field from the other path. A missing budget would not announce itself — the campaign would simply refuse to publish later |
| W3 · attach later | The offer attaches | **Never exercised.** No `campaign_influencers` row carries an offer today, so attaching one is untested in practice, not just untested in code |

## The prediction most likely to be wrong

**That removing nine blocks is risk-free.** It is not. Eight of them are conditional, and the
condition is the thing that separates a commission set from a content set. The tests below the
line cannot see a layout — only the walk can.

## What this deliberately does not predict

Whether the shorter screen is *better*. It is shorter and it is what was asked for. Whether it
reads well on a handset is a person's judgement, not a check's.
