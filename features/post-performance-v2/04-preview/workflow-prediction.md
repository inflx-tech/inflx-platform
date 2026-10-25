# Workflow prediction — post-performance-v2 (Level 2: the campaign post on Instagram and YouTube)

**Pay for Content, Priya for Winter Run › Set B.** Her package (1 reel, 2 stories, 1 YouTube Short) is approved →
she pastes the reel link and the Short link, adds the two story screenshots, taps "I've posted everything" →
under each link her screen now says "Numbers come the morning after you mark it posted"; under each story
"Screenshot · stories can't be tracked". The reel is among her newest posts that Level 1 already measured, so
within the minute the line reads "31.2K views · 2,900 likes · 140 comments · From your channel numbers, 12 Oct".

**06:10 the next morning.** The post-stats job runs after the hour's creator-channel tick, checks the month's
Apify spend is under US$5, sends the due Instagram links in one run and the due YouTube links in another
(each run with its id and cost in the run log), and writes a reading per link. Priya's reel: "48.2K views ·
3,910 likes · 212 comments · Updated today 6:10 am". Her Short: "12.7K views · 880 likes · 41 comments".

**The brand opens the content screen** → the same two lines sit under the links it already opens; the stories
keep their screenshot line. "Update now" at the foot re-reads both links once; a second tap the same day says
"Numbers were updated 2 hours ago. Once a day." The brand confirms live → nothing about the numbers changes.

**The brand website, campaign page › Analytics** → tiles VIEWS 61.8K · LIKES 5.2K · COMMENTS 318 · LINKS READ
12 of 14; by set, by creator, then every link with its line; one "Update now" for the campaign; the footnote
says what is read and on which days.

**Pay for Sale, Priya for Sri Lakshmi Silks › Set A.** Her shoppable post "Festive Sarees" (K7M2F9) is approved;
she names an Instagram reel and a YouTube video for it, posts, links, marks posted → both links are tracked.
Her Post status gains one line "On social media · 48.2K views · 3,910 likes"; Post stats gains the block
"On social media" above "By channel": one card per link. The brand's Set posts list shows under K7M2F9
"On social media · 60.9K views · 4.8K likes · 253 comments · 2 links"; under a post whose links are missing
"Social links not added yet"; the brand's post stats shows the same block, read-only, with "Open on Instagram".

**The schedule.** Readings on day 1, 2, 3, 5, 7, 10, 14, 21 and 30, then every two weeks until day 90, then it
stops: the line keeps its last numbers with "Last read 14 Jan". A Pay for Sale link also stops when its post
leaves the shop. Pay for Content follows the same curve past the final payment.

**The guard rails.** Month spend at US$5 → the job skips, flags admin once, catches up next month; creator
channel numbers keep running. A link whose owner is another account (and not a co-author) → numbers kept,
admin flag "Posted from another account", brand sees "Posted from @other, not her account", creator sees
"This link isn't on your account @priya.style". Likes hidden → "Likes hidden". Comments off → "Comments off".
A post deleted → "This post is no longer public", tracking stops. Facebook link → "Facebook numbers come later".
Apify down → "Couldn't read this link · we'll try again tomorrow".

**Admin.** `/admin/analytics` reads "Apify this month: $2.67 of $5 · creators $2.14 · posts $0.53"; the flags
list carries the other-account flags with both handles; the collaboration page has Measure now (exempt from
the budget).

**What never happens.** No money moves because of a number. No shares, reach, saves or engagement rate are
shown anywhere. Nothing reads `deliverables.live_url` or writes `deliverable_stats`. No Apify call carries the
token in a URL.
