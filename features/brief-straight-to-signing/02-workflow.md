# Workflow — brand briefs, creator signs

## Before

```
brand briefs her
  -> campaign_influencers.status = 'invited'
  -> she opens the app
  -> INVITATIONS tab
  -> taps it
  -> BLANK PAGE                       <- the reported bug
  -> (if it had worked) accept terms she already agreed
  -> brand drafts a contract
  -> TO SIGN tab
  -> she signs
```

Seven steps, three of them asking for a yes she had already given, one of them broken.

## After

```
brand briefs her
  -> agreement clean?
      YES -> contract created 'pending_influencer', row -> 'accepted'
             -> TO SIGN tab
             -> she opens it and reads the whole deal
             -> SIGN  or  DECLINE (reason + her own words)
      NO  -> old path: 'invited', she re-agrees first
             (the agreement drifted; she must see the new terms)
```

## What she reads before signing

| Section | Source | Was it there before? |
|---|---|---|
| Campaign name, brand | `campaigns`, `brands` | yes |
| **What she can sell** | `describeAllocation(ci.alloc_*)` | **no** |
| Agreed fee / commission | `contracts`, `ci.commission_pct` | yes |
| Deliverables | `deliverables` | yes |
| Production arrangement | `production_events` | yes (Stage 4) |
| **Shopper offer, by name** | `brand_offers.name` | **no** |
| **Offer valid period** | `ci.offer_valid_from/until` | **no** |
| **What happens to her content** | `describeUsage(agreement.terms_json->usage)` | **no** |
| Payment schedule | tranche rules | yes |
| Signatures | `contracts` | yes |

Set name is deliberately absent — the founder: *"this is the brands one, just campaign name is
enough."*

## Declining

```
she taps "I can't do this collaboration"
  -> askDeclineReason()  - the five keys the server accepts, one list
  -> DeclineSheet        - her own words, optional, max 1000 chars
  -> POST /offers/:ciId/decline { reason, note }
  -> status 'declined', declined_reason, declined_note
  -> the unsigned contract is DELETED
  -> back to Collabs
```

The same sheet renders on the collab screen. One component, one API call, one set of reasons.

## Expected end state

A creator briefed on a clean agreement goes from notification to signed contract in **two taps**,
having read every term that decides what she earns — and can refuse in one.
