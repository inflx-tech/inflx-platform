# Impact — pre-campaign handshake

**Verdict: the largest change in the program. A new capability, a new stage in the
brand↔creator lifecycle, and one significant behaviour REMOVAL — acceptance stops fabricating a
campaign.**

## Blast radius

| Area | Impact |
|---|---|
| Brand → creator outreach | **New.** Did not exist in any form |
| Creator pitch lifecycle | Unchanged, except acceptance now yields an agreement |
| Acceptance behaviour | **Stops creating a campaign / set / assignment / contract** |
| Campaign creation | Gains agreed creators, pre-filled terms, consumption |
| Creator campaign acceptance | Negotiate hidden when terms were already agreed |
| Rate limits | Move from code constants to admin settings, both sides |
| Negotiation, contracts, deliverables | **None** |
| Allocation, offers, commission, money | **None** |

## Risks

**Acceptance no longer creating a campaign is a removal, not an addition.** Anything downstream
that assumed a campaign appears on acceptance will find nothing. The proposal acceptance path is
its only caller, but the contract auto-create it triggers is shared — that call is removed from
this path only, and the contract is created later from the campaign instead.

**Two record types converging on one agreement** is where a subtle bug would live. An agreement
must know which record it came from, and consuming it must not orphan the source.

**Limits moving to settings** means a missing or malformed row could disable or uncap the flow.
Reads fall back to today's constants, so absence is safe rather than fatal.

**Broadcast volume.** A filter-matched request could reach hundreds of creators. Capped by
settings, muted creators excluded, and the brand is told reached-vs-matched rather than being
left to assume everyone got it.

**Mobile is held.** Maestro is parked by founder decision, so the mobile leg does not ship with
the web leg. The backend must therefore be safe for an app that has not been updated — old
builds must not break because new endpoints exist.

## Deploy classification

**Production-impacting.** `backend/src/**`, migrations, `Packages/brand-web/**`, and
`Packages/Mobile/src/**` when the mobile leg ships.

Targets: Render, Vercel, and OTA when mobile ships. Migration runs before the backend deploy.

**Gates:** mockup locked ✓ · `06-diff/notes.md` required before release · Maestro required
before the mobile leg flips `released` · explicit founder go before push.
