# Workflow

## What he saw, and why

```
CREATOR PHONE
  Collabs -> Asha's collab
    hero: "You are live — share your link"        <- hasShoot always false
          [ blank grey button ]                   <- 'tracking' had no label either
    no Logistics card                             <- fixed yesterday, needed the payload too

BRAND PHONE
  Campaigns -> the shoot
    "The shoot · STORE VISIT"                     <- yesterday's fix DID land
    "No time suggested yet"                       <- correct, it is the planning state
    "PICK ANY DAY BETWEEN [blank] and [blank]"    <- range unwrapped one level too few
                                                     AND the window is genuinely empty
```

## After

```
CREATOR PHONE
  hero: "The shoot — settle the time, confirm what arrives, and shoot."
        [ Plan the shoot ]                        <- the button has words
  Logistics card in the list

BRAND PHONE
  "No day works
   The post is due too soon for a visit to fit before it. A visit has to finish two
   days before the posting date. Move the posting date back and the days will appear."
```

## Once the posting date moves

```
  "Pick any day between  Sun, 30 Aug  and  Thu, 10 Sep"
   Because she has to post by 12 Sep.
     -> brand sets address (+ optional time)
     -> creator proposes or accepts
     -> either counters, twice each
     -> accepted -> Settled
     -> both mark it done -> Complete
```

## Expected end state

Both phones show the same store visit, the button that opens it says what it does, and when no
day can satisfy the rules the screen says which date to move.
