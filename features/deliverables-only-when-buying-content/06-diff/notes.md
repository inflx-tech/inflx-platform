# Before / after

**Reported, with a screenshot of the brand's own phone:**

> *"Contract signing failed: Cannot create contract: campaign set has no deliverable formats.
> Add at least one format (reel/post/story/...) before signing."*

## The countersign

**Before** — a commission campaign could be built, briefed and signed by the creator, and then
**could not be completed at all**. The wizard deliberately saved an empty format list for a
commission set; the server called that an error.

**After** — it goes through and creates no deliverables, because nothing was bought.

## The error, when it is still right

A brand paying a fee must still say what content. That message was written for a database:

> ~~*"Cannot create contract: campaign set has no deliverable formats configured. Edit the set in
> the campaign wizard and add at least one format (reel/post/story/...)."*~~

Now:

> **"This campaign pays for content, so the set has to say what content. Open the set and add at
> least one format — a reel, a post, a story — before signing."**

## The reel nobody asked for

`getMyCampaignDetail` self-heals a signed collaboration that has no deliverables by creating
them. With no formats it fell back to **one reel** — so a commission creator would have opened
her app and found a pending reel she had never agreed to deliver, with a deadline.

Deleted. The same function decides for both paths now.

## Her screen after signing

**Before** (had she got there) — *"The shoot — Settle the time, confirm what arrives, and shoot"*,
for the entire campaign, because the only way out of that stage is deliverable progress a
commission creator never has.

**After** — *"You are live — Share your link and earn on every sale it brings."*

A commission collaboration that **does** have a store visit or a parcel still shows the shoot.
No seventh stage was invented; her section cards are unchanged.

## Screenshots

Not captured. The proof that matters is the founder counter-signing Asha's contract on his own
phone — the exact tap that produced the screenshot.
