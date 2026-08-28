# Workflow

## Before

```
both parties sign
  -> autoCreateForContract(contract)
       contract.production_mode = NULL          (approve was skipped by design)
       -> mode = 'remote'                       INVENTED
       -> status = 'completed'                  AT BIRTH
  -> nothing to plan, nothing to negotiate, nothing to mark
  -> "shoot plan is done"
```

## After

```
both parties sign
  -> autoCreateForContract(contract, agreementMode)
       resolveProductionMode({ contractMode: null, agreementMode: 'visit' })
         -> { mode: 'visit', source: 'agreement' }
       initialStatusFor('visit') -> 'proposed'
  -> THE PLANNING STATE

     brand   -> setVisitDetails(address, contact, [slot])   slot_proposed_by='brand'
     creator -> proposeSlot(slot)                           slot_proposed_by='influencer'
     either  -> counterPropose(...)      up to 2 reschedules per side
     other   -> accept()                 cannot accept your own proposal
                                         -> 'confirmed'

  -> THE SHOOT

     creator marks done  -> influencer_completed_at
     brand   marks done  -> brand_completed_at
     both present        -> status 'completed'
```

## The other two modes

```
shipment  -> 'proposed'   she confirms the address -> 'confirmed'
                          brand dispatches + AWB   -> 'in_progress'
                          she confirms receipt     (stays in_progress — receiving is not shooting)
                          SHE marks the shoot done -> 'completed'

remote    -> 'confirmed'  nothing to arrange
                          SHE marks the shoot done -> 'completed'
```

## Who closes it

| Mode | May mark it | Enough to close it |
|---|---|---|
| Store visit | brand **and** creator | **both** |
| We ship to her | creator only | creator |
| Remote | creator only | creator |

Her mark is required in every mode.

## What each side sees while waiting

```
she has marked, brand has not:
   her screen    "You have marked the visit done. It closes once the brand marks it too."
   brand screen  "Mark the shoot done"  [button]
```

## Expected end state

After both signatures, both phones show a store visit with **no time set yet** and an invitation
to propose one — and the shoot closes only when the two people who were there say it happened.
