# A draft resumes, and a lapsed creator leaves on her own

Two changes, both from the founder on 2026-08-28, and both replacing a refusal with the app
doing the obvious thing.

---

## 1 · The agreement window, measured

Before agreeing to either, the numbers were read out of production rather than recalled:

| `handshake_settings` | |
|---|---|
| **`agreement_expiry_days`** | **90** |
| `request_ttl_days` | 7 |
| `decline_cooldown_days` | 30 |

22 live agreements, lifetimes running 9–90 days. **Configurable, not hardcoded.**

That number matters, because it settles a disagreement. I had defended the "dead agreement"
publish blocker with a story about picking a creator on Monday and publishing on Thursday.
**At 90 days that story does not hold.** For an agreement to lapse mid-build you would have to
leave a campaign open for most of three months.

The founder's own screen showed *"Divya's agreement expires in 3 days"* — which means it was
agreed **87 days ago**, not that he was slow.

## 2 · A lapsed creator is removed, not blocked

> *"if that is expired means auto deleted... even he adds set and came after somedays if that is
> expired means auto deleted."*

He is right, and it is better than what was there.

A lapsed agreement **cannot** be briefed — `listReadyToBrief` filters to
`status = 'ready' AND expires_at > now()`, and the invite endpoint refuses anything else. There
is no judgement for a brand to make. Refusing to publish and leaving them to work out which
creator to remove was the app handing over its own homework.

**When:** whenever the set is opened, not at publish. His call, and the right one — a brand
should never be looking at a creator who cannot actually be included.

⚠️ **Two things this must not do:**

* **Fire before the live list has loaded.** The check runs against `agreements`, which starts
  empty. Without an `agreementsLoaded` guard it would clear every picked creator on every
  entry — indistinguishable, to a brand, from the app losing their work.
* **Happen silently.** A creator who vanishes reads as a mis-tap, or goes unnoticed until the
  campaign is live without her. She is named, with the reason and what to do.

## 3 · A draft opens where the work stopped

> *"if campaign not fully publish means it is in draft state, when brand come and open this
> draft one it has to reach where step stops."*

Tapping any campaign went to `CampaignDetail` — a dashboard. On a draft that shows **0%
progress, no deliverables, no budget**: nothing the brand did not already know, and none of the
half-built set they came back for.

A draft (or one waiting on its wallet) now opens the **builder** — its sets, and what each still
needs. Anything published opens the dashboard, unchanged.

**It deliberately does not jump into a particular set.** With two half-built sets there is no
way to know which was meant, and guessing wrong costs more than one tap.

---

## 4 · ⚠️ The limit of "resume", which the founder should know

The creators pencilled into a set are held **in memory only** — no AsyncStorage, no server rows.
This is deliberate (ledger #77): an agreement is consumed on publish, so abandoning the wizard
must not burn it.

**So resume gets you back to the right screen. It does not restore ticks made in a previous app
session.** Within one session everything survives; across a restart the picks are gone and the
creators must be picked again.

Whether that should change is a design question, not a bug, and it is raised with him rather
than decided here.

## 5 · Out of scope

* **The publish gate's dead-agreement blockers stay.** The auto-drop handles the set a brand is
  looking at; the gate is the backstop for anything already invited, which the drop never sees.
* The expiring-agreement warning stays — being told before is better than being tidied up after.
* Persisting the picks. See §4.
