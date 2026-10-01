# Workflow prediction — posting-date-last-day
Trigger: INFLX approves a shoppable post. End state: the post is in the shop at once (feed, stores,
search, link, code), "Live" on her screen and the brand's; nothing waits for the set's posting date.
An offer post approved before its offer starts stays "Approved", says the start day everywhere, and
goes live that day; it leaves the shop when the offer ends. Approved after the posting date: live,
and marked late. Terms: the offers sheet lists only offers that start by the posting date and end
after it; products without offers are only those in no offer from today. No row is written
differently and no money moves — what changes is which approved posts the shop shows, and which
offers and products a brand may give in the next invitation.
Edges: offer starts tomorrow (waits one day) · offer ends on the posting date (not offered) ·
product in an offer until next week (not offered as "without an offer") · a collaboration sent
before today (keeps what it was given).
