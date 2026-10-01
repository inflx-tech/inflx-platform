# Going live — walk report, 1 October 2026

Founder's walk of a Pay for Sale Store Visit after the shoot: set **Men** in campaign **Pay day
sale**, creator Kartikeya, posting date **8 Oct**. Four things were reported, plus one question
about the posting date. Everything below was checked against the code and, read-only, against the
production record of this collaboration. Nothing was changed.

> **Decided the same day (after this report):** the founder chose the opposite of §5's
> recommendation — **the posting date is the last day to go live**. A post is in the shop as soon as
> INFLX approves it; an offer post only while its offer is active. Rules v1.15, contract
> `features/posting-date-last-day`. §4 and §5 below describe the rule as it stood on the morning of
> 1 Oct. Fixes 1–3 in the table at the end are still open.

## What production recorded (India time, 1 Oct)

| Time | What happened |
|---|---|
| 3:51 pm | Shoot marked by the creator and confirmed by the brand |
| 3:52 pm | Shoppable post "Outfits and accessories" started (one video, 14 seconds, 720 × 1280) |
| 3:55 pm | Creator opened Going live |
| 3:57 pm | Post sent to INFLX |
| 3:58 pm | INFLX approved it — post code **KNTZXR** |
| 4:01 pm | In "Share on social media" she picked the post and a place, and **uploaded a video** for it |
| 4:06 pm | That row — and its video — was **taken out** |
| — | **Nothing was ever sent to the brand.** No package exists |
| 4:11 pm | Brand's screen: "Her move. She hasn't sent what she'll share yet." (correct for the record) |

## 1 · "She sent the social post but it did not reach the brand"

**Finding: the brand's screen is right. Nothing was sent. The upload was removed five minutes later.**

On the creator's screen, uploading the video is only step one. The package goes to the brand when
she taps **"Send to <brand>"** in the bar at the bottom and confirms on the sheet that opens. The
server has no record of that. It does have a record of the row being removed, which only one
control does: **"Take this out"**, a text button directly under the caption box of the row.

Two weaknesses in the screen make this easy to get wrong (the likely cause; I cannot see what was
tapped):

- **"Take this out" deletes the row and the uploaded video at once, with no "are you sure".** It is
  the only action inside the row's card once the video is in.
- **Nothing says "not sent yet".** After the upload the screen looks finished; the line under the
  Send button is empty.

Not a server fault. Recommended fix: a confirmation before "Take this out", and a plain line under
the Send button — "Not sent yet. Tap Send to <brand>."

## 2 · "The approved post shows nothing in the brand app"

**Finding: built that way. The brand app never shows a post's photo or video anywhere.**

The row draws an empty grey box where the picture should be — the locked board drew a plain
coloured box and the build copied it. The server already sends the post's cover and whether it is a
video; both phones ignore it. The brand also cannot open the post: tapping the row does nothing on
Going live, and the set's "Posts" screen opens numbers only.

**Do we need a media player in the brand app?** The player is already inside the app build of
30 Sep (all three apps share it). What is missing is a screen that uses it. A phone still on an
older install would show the picture and an "update the app" note instead of playing.

Recommended fix: show the real cover in the post row (both apps), with a play mark for a video, and
open the post full-size on tap.

## 3 · "In Admin it plays, but small"

**Finding: built that way.** The review page draws every photo and video 176 pixels tall. A
vertical phone video is then about 100 pixels wide — too small to judge quality, which is the
reason INFLX reviews posts at all.

Recommended fix: a large player on the review page (about 70% of the window's height), keeping the
small strip for a post with several slides.

## 4 · "The post is not visible in the shopper app"

**Finding: correct by the rules. A post enters the shop on its posting date — 8 Oct.**

The brand's screen says so: "In the shop from 8 Oct". Before that day the post's link opens a page
saying "This post goes live on 8 Oct". Checked for this post, one condition at a time:

| Condition | This post |
|---|---|
| Approved by INFLX, has its code | Yes |
| Posting date reached | **No — 8 Oct** |
| Its offer is running | Yes — "Year end sale", 1 Oct to 9 Oct |
| A product in stock | Yes — police watch, 7 in stock |

Two things to know:

- **The whole shop is empty today.** This is the only approved post on the platform, and no approved
  post has reached its posting date yet.
- **This post will be in the shop for two days only.** Its offer ends on 9 Oct, and a post leaves the
  shop when its offer ends. Allowed by the rule (an offer must be valid on the posting date or the
  day after), and the terms screen warns when an offer ends within 7 days of posting.

There is no way to see a post in the shopper app sooner by making a new set: a posting date must be
**at least 7 days ahead** when the set is created, and this set (made 1 Oct, posting 8 Oct) already
took the earliest day allowed. The first post any shopper can see is this one, on 8 Oct.

## 5 · The posting date — exactly on the day, or by the day?

**What the system does today**

| Step | Rule today |
|---|---|
| Shoppable posts made and approved by INFLX | Any time **before** the date. Approved later still counts, marked "late", no penalty |
| The post appears to shoppers | **On** the date, automatically, for every creator in the set at once. Never before |
| Social version approved by the brand | Any time before the date |
| She posts on social media and adds links | Not blocked before the date. Flagged Delayed the day after the date if not confirmed live; links expected within 2 days of the date |

So the date is already a **start line**: preparation happens before it, the shop opens on it by
itself, and the social posts are due on it.

**Recommendation: keep it as "on the day" for the shop, and "on the day, up to 2 days after" for
social media. Do not allow going live before it.** Three reasons:

1. **The terms are built on that one day.** An offer is given only if it is valid on the posting
   date; a product "without an offer" is only checked to be free from the posting date onward. A
   post visible earlier could show an offer that has not started, or sell at full price a product
   another creator's offer still holds.
2. **One day gives the brand a launch.** Every creator's post and social post land together.
3. **Nobody can miss it.** The shop opening is automatic.

**Two small improvements worth making**

- **Tell her not to post on social media early.** Today nothing stops it, and her link would open
  "goes live on 8 Oct" with nothing to buy. One sentence on her screen: "Post on 8 Oct — your link
  opens the shop from that day."
- **Decide whether 7 days is the right minimum.** The app does not let a brand choose a posting date
  nearer than 7 days. In this walk the invitation, signatures, shoot plan, shoot, post and INFLX
  approval all happened in one day, and the set now waits a week. Seven days is sensible for real
  creators (a shoot to arrange, content to make, two reviews), but it is a fixed number in the code.
  Making it an Admin number would let you shorten it for launch testing and tune it later. A founder
  decision; nothing changes until you say.

## Fixes proposed (none built yet)

| # | Fix | Where | Size |
|---|---|---|---|
| 1 | Confirm before "Take this out"; "Not sent yet" line under Send | Creator app | Small |
| 2 | Real cover in the post row; tap to view the photo or play the video | Brand and creator apps | Medium |
| 3 | Large player on the post review page | Admin website | Small |
| 4 | "Post on <date>" sentence for the creator | Creator app | Small |
| 5 | Make "posting date at least 7 days ahead" an Admin number | Server, admin settings | Small; your decision first |

No money in any of them. Only fix 5 needs a (small) database change.
