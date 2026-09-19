# registration-and-profile — the founder's decisions

Source: chat, 18 Sep 2026. Three rounds. Round 1 was a read-only survey of the live
registration path (no code changed). Rounds 2 and 3 are the founder's answers. This file is
the record of what he decided, in his order, so the spec can be checked against it.

## The framing

> "First issues need to resolve: Registration / profile / Things which is related to
> registration and profile info … clear wiring between provided info and used info.
> next based one these we create business process for approval of brand and creator."

> "First leave about what we have in web site … first we completly concentrate on mobile
> phone registration and profile and related wiring features with platform … same backend,
> same thing we apply to web."

Mobile is the build. The website is re-skinned afterwards off the same backend. Nothing in
this contract touches brand-web.

## The decisions, as given

1. **Brand phone** — "we consider registered phone number as brands and creators phone
   number." No separate business phone field.

2. **Google Places — remove** — "remove completly google places search features anywhere we
   have in address finding … this eliminates the requirement og google places APIs … for now
   we concentrate in future versions." Applies to address entry only; see 12.

3. **Email** — "we ask this at profile and also ask to verify this through OTP or link."
   Revised after the infrastructure flag: "We collect email for now … auto verification
   through code or link we make it in next version … mobile number we have thats it."

4. **Two-part data collection** — "we keep registration simple with mandatory things to
   validate and as easy registration process … remaining things we keep in profile for later
   filling … we keep asking with pop to to fill the info … in offline our executives also
   inform them to fill."

5. **Address shape** — "while entering address we take free text only street address …
   remaining things like possible things like state, city fixed list … city and state is
   mandatory pre filled list where we can match them to other things in our platform like
   brand and creator search."

6. **Approval gate** — "keep signup short, but make approval refuse an incomplete profile
   rather than let it through … this what i am saying."

7. **Terms acceptance** — "This is too much not required in our current version."

8. **Niche and languages** — "we give some list of both … creator should select those … also
   we give an option like others … if others selected then ask what is that … languages we
   give all 30 Indian major languages plus English." And on what happens to an Other answer:
   "This is good … turns others one into our niche list."

9. **Brand sub-categories** — "here we are already asking while registration … in profile we
   give all those he can edit in profile." (Already true. No change.)

10. **Referral** — "Leave about this entire referral system for now, remove that referral code
    one … i think we dont have any referral one in app so we leave for now."

11. **Money fields** — "We move this entire thing to wallet instead of profile … Here we check
    everything through manual verification … our team will verify … for now if we technically
    concentrate and check pattern and form is little technical for now we dont go into this."
    And: "All bank info, its verification, check, gstin, all will take care by team offline …
    we keep all in wallet tab."

12. **Follower app location** — "here in followers app this is most important … we keep in
    followers app … we setup this when follower opens the app we capture their current
    location … based on this only our followers app posts feed will go." Google stays there.
    Out of scope for this contract.

13. **Same number, both roles** — "We accept same number to be both creator and brand."

14. **Rejection** — "if admin reject an account he mentioned remarks … and freshly it will give
    form with filled data earlier then person can edit or change things what he typed wrongly
    and submit again … simple."

15. **Agreement identity fields** — "add these things in agreement which reads from added
    things … this happen during agreement … this happens when brand creates campaign … by that
    time our team verify all … and make them fill the details." And on gating campaign
    creation: "Dont do that … we will make sure we collect this info before campaign get
    created … if not make it these fields emty in agreement."

16. **Creator age and gender** — "we ask in profile."

17. **Branches** — "at profile if he adds one more branch then we ask clearly which one is main
    branch."

18. **Pending user reaches the app** — "he can enter app … but cant create any campaign, browse
    influencers … only things accessible is popup to complete profile … note: this make admin
    to approve fast and help to verify your account kind of note … only profile he can add,
    edit … and he can see home screen and all … but trying to do any action then message with
    pending approval."

## The city and state decision

Asked whether to seed a full Indian city master, keep an escape hatch, or both, the founder
chose neither — a deliberately smaller, southern-first list:

> "i propose major cities in a state … also we focus main states only all southern states …
> for now … as a first version … next we concentrate how to handle like adding google places,
> or something else … say in andhrapradesh we focus major cities … like all district
> headquarters … we ask to select region like near city … ask to select near city not exactly
> their living area or small town … it is simple … later we focus on it … dont take all states
> … focus on southern states for now … later we focus on this while expanding. this should be
> logical drop down, state and city."

Both draft lists were then approved:

> "this is fine, what actually needs … ok drop sankrit … now no one speaking."

## The sequence he set

> "next lock these things then draw the mockups then we lock mockups then we start building."

Spec lock (this contract) → mockups → mockup lock → build. No app code before the mockup lock.

## Three corrections the founder accepted in passing

Stated back to him during the rounds and not disputed:

- **His "most of the thing is working now except a popup" was half right.** The brand's
  actions are already refused server-side with the right message. The creator's actions are
  refused nowhere. And no pending user reaches the app at all today — they hit a dead-end
  Waiting screen whose only button is Sign out. Opening that door is the real work, and it is
  what makes the creator-side gap live.

- **Removing Google Places costs nothing in any flow that is live today.** Coordinates are read
  only by the shopper feed's distance ranking and the meal-radius rules, both dormant while the
  follower app is profile-only. Store visits use the typed visit address. The agreement uses
  city and state.

- **Brand sub-categories already behave exactly as he described**, so that line of his is a
  confirmation, not a change.
