// Refunds, Content & IP, Copyright takedown, Ranking transparency — INFLX legal content.
// Prose is data; the renderer at app/legal/[slug]/page.js turns it into HTML.

export const refunds = {
  slug: 'refunds',
  title: 'Refund & Cancellation Policy',
  group: 'policies',
  summary: 'When you can cancel, what you can return, how refunds work and how long they take.',
  appliesTo: 'Shoppers who buy, book or pre-book through INFLX, and the brands who sell to them.',
  version: '1.0',
  inShort: 'The brand you buy from is the seller. We run the platform and process the payment. You can cancel before dispatch, or before a booking window opens. Most physical goods can be returned within 7 days of delivery, and an approved refund always goes back to the way you paid.',
  sections: [
    {
      id: 'who-you-are-buying-from',
      heading: 'Who you are buying from',
      blocks: [
        { p: 'INFLX is operated by {{ENTITY}} (CIN {{CIN}}), with its registered office at {{REGISTERED_ADDRESS}}. When you buy a product, book a slot or pre-book something here, **the brand is the seller** — not us. The brand owns the stock, sets the price, writes the description and is responsible for delivering what it promised.' },
        { p: 'We operate the platform the listing appears on, process your payment through our payment partner, and help when something goes wrong. We do not manufacture, inspect or store the goods. This policy takes effect on {{EFFECTIVE_DATE}} and should be read with our [Terms of Use](/legal/terms).' },
        { callout: { label: 'Why this matters', p: 'Your contract for the goods or the service is with the brand. Your refund still comes back through us, because that is how the money reached the brand. So raise the problem with us — you do not have to chase the brand yourself.' } },
      ],
    },
    {
      id: 'cancelling',
      heading: 'Cancelling an order or a booking',
      blocks: [
        { p: 'You can cancel an order at any time before the brand marks it as dispatched. Open the order and choose Cancel. The refund is raised straight away and you do not have to give a reason. Once an order is dispatched it can no longer be cancelled — refuse the delivery, or raise a return using the steps below.' },
        { p: 'For bookings, slots and pre-bookings, the cancellation window is set by the brand and shown to you before you pay. You can cancel free of charge before that window opens. Inside the window, the terms the brand published apply. If the brand cancels, does not turn up, or cannot fulfil a pre-booking, you get the full amount back.' },
        { p: 'A booking you did not attend and did not cancel is treated as used. We will not charge you a cancellation fee unless we are ourselves charged an equivalent amount, and if that happens the amount and the reason are shown to you before you confirm.' },
      ],
    },
    {
      id: 'what-you-can-return',
      heading: 'What you can and cannot return',
      blocks: [
        { p: 'You have **7 days from delivery** to return an eligible product. The same window applies across INFLX, so you never have to check what it is for a particular item. To be returnable, an item normally has to come back unused, in its original packaging, with any tags and accessories it arrived with.' },
        { p: 'These generally cannot be returned once they are yours:' },
        { ul: [
          '**Perishable goods** — food, drink, flowers, anything with a short shelf life.',
          '**Made-to-order goods** — furniture built to your measurements, tailored clothing, bespoke work of any kind.',
          '**Personalised items** — anything engraved, monogrammed or printed with your name or your design.',
          '**Services already used** — a haircut done, a meal eaten, a session attended, a car already driven.',
          'Goods that cannot be resold for hygiene reasons, such as innerwear and swimwear, once the seal is broken.',
          'Anything marked non-returnable on the product page before you paid for it.',
        ] },
        { p: 'None of that applies if the item arrived damaged, defective or incomplete, or is not what the listing described. In that case you can return it whatever category it falls in, and you do not pay to send it back.' },
      ],
    },
    {
      id: 'how-to-raise-a-request',
      heading: 'How to raise a return or refund request',
      blocks: [
        { p: 'Open the order in the INFLX app and ask to cancel or return it, or write to us at {{SUPPORT_EMAIL}} with your order number. Tell us what went wrong, and add photos if the item is damaged, defective or different from the listing — photos settle most claims in a single round.' },
        { p: 'We confirm your request and give you a reference for it, then take it up with the brand on your behalf. If a pickup is needed, we arrange it and tell you when to expect it.' },
        { p: 'We acknowledge a complaint within **24 hours** and work to resolve it within **7 days**, in line with applicable law.' },
      ],
    },
    {
      id: 'what-happens-in-each-case',
      heading: 'Common situations',
      blocks: [
        { p: 'Most requests fall into one of these. Where your case is not listed, raise it anyway and we will treat it on the same principles.' },
        { table: { head: ['What happened', 'What happens next'], rows: [
          ['You cancelled before dispatch', 'Full refund, including any delivery charge'],
          ['The item arrived damaged, defective or not as described', 'Full refund or a replacement, your choice, plus a free return pickup'],
          ['Delivery is late', 'Cancel and take a full refund, or wait for it — your call'],
          ['The brand cancelled your booking, or did not turn up', 'Full refund, raised as soon as the brand cancels'],
          ['You cancelled a booking', 'Full refund before the cancellation window opens. Inside the window, the brand’s published terms apply'],
          ['You changed your mind about a returnable item', 'Refund of the item price once it comes back in resaleable condition. Return shipping may be deducted'],
          ['A pay-at-store deal was not honoured at the counter', 'Nothing was charged through us, so there is nothing for us to refund. We take it up with the brand and can pull the deal'],
        ] } },
      ],
    },
    {
      id: 'how-the-money-comes-back',
      heading: 'How and when the money comes back',
      blocks: [
        { p: 'Every refund goes back to the payment method you used. We cannot send it somewhere else — not to a different card, not to another person’s account, not as cash. That is a rule of the payment system, not a preference of ours.' },
        { p: 'We raise the refund with our payment partner as soon as the request is approved, or as soon as a returned item is received and checked. How long it takes to appear after that depends on your bank, card issuer or UPI app, and that part is outside our control.' },
        { p: 'If you paid at the store counter, no money passed through INFLX, so there is nothing here for us to refund — anything owed comes from the brand directly, and we will help you ask for it. You can see the status of every refund on the order screen.' },
      ],
    },
    {
      id: 'escalate',
      heading: 'If you are still not happy',
      blocks: [
        { p: 'Reply to us on the same request first. Most cases turn on one missing photo or a wrong address, and answering on the existing thread is quicker than starting again. If the answer still does not work for you, escalate to our Grievance Officer.' },
        { callout: { label: 'Grievance Officer', p: '{{GRIEVANCE_OFFICER}}, {{GRIEVANCE_DESIGNATION}}\n{{ENTITY}}, {{REGISTERED_ADDRESS}}\n{{GRIEVANCE_EMAIL}} · {{GRIEVANCE_PHONE}}' } },
        { p: 'The full process is at [Grievance Redressal](/legal/grievance). You can also take a consumer complaint to the consumer forums under the Consumer Protection Act 2019 — coming to us first does not take that right away. General questions go to {{SUPPORT_EMAIL}} or {{SUPPORT_MOBILE}}.' },
      ],
    },
  ],
  related: ['terms', 'privacy', 'grievance'],
};

export const ip = {
  slug: 'content-ip-policy',
  title: 'Content & Intellectual Property Policy',
  group: 'agreements',
  summary: 'Who owns the content and the brands on INFLX, and what each of us is allowed to do with them.',
  appliesTo: 'Everyone who uses INFLX — brands, creators, shoppers and anyone who posts anything here.',
  version: '1.0',
  inShort: 'You keep what you make. Creators own their content, brands own their brands, and we own INFLX itself. Putting something on INFLX gives us — and, for campaign work, the brand — permission to use it for what it was made for, and nothing more.',
  sections: [
    {
      id: 'what-this-covers',
      heading: 'What this policy covers',
      blocks: [
        { p: 'This policy explains who owns what on INFLX, which is operated by {{ENTITY}}, and what each of us may do with the other’s material. It takes effect on {{EFFECTIVE_DATE}} and forms part of our [Terms of Use](/legal/terms).' },
        { p: 'Three sets of rights meet on this platform: ours in the software, a creator’s in the content they make, and a brand’s in its name, products and listings. Nobody gives up ownership by using INFLX. What everyone gives is permission to use something for a stated purpose.' },
      ],
    },
    {
      id: 'what-we-own',
      heading: 'What we own',
      blocks: [
        { p: 'The INFLX name, our logo and brand marks, the software behind the website and the apps, and the design of the site and the apps belong to {{ENTITY}}. So does the content we produce ourselves — help articles, guides, these legal pages and our own marketing material.' },
        { p: 'You may use INFLX for what it is built for. You may not copy the software, take it apart to work out how it is built, scrape the site, or build a competing product out of what you find here.' },
        { p: 'Seeing a name or a logo on INFLX gives nobody permission to use it. You may say factually that you are on INFLX, but you may not use our name or mark in your own advertising, product name, domain or social handle without our written permission, or suggest that we endorse you when we do not.' },
      ],
    },
    {
      id: 'what-creators-own',
      heading: 'What creators own',
      blocks: [
        { p: 'If you are a creator, you own the content you make — your photographs, your video, your voice, your writing, your edits and your own likeness. Uploading it to INFLX does not transfer ownership, and nothing in this policy takes it from you.' },
        { p: 'By submitting content, you give us permission to host, store, display and distribute it inside INFLX — on listings, in sections, on storefronts and in share links — and to use it in our own promotion of the platform. You also give the brand whose campaign you accepted permission to use that content for that campaign, on the channels and for the period the campaign sets out. Neither permission is exclusive unless the campaign says so and you signed it.' },
        { p: 'A brand cannot quietly widen its use later. To use your content for longer, on more channels, or in its own advertising, it has to come back with a new offer that you can accept, negotiate or decline.' },
      ],
    },
    {
      id: 'what-brands-own',
      heading: 'What brands own',
      blocks: [
        { p: 'A brand owns its trading name, its logo, its trademarks, its product photography, its menus and its listing text. We claim none of it.' },
        { p: 'By listing on INFLX, a brand gives us permission to show that material wherever the platform needs to show it — on the listing, in search results and sections, on a creator’s storefront, in a share link preview, in order confirmations, and in our own promotion of what is available. That permission runs for as long as the brand is listed with us.' },
        { p: 'A brand also confirms, each time it lists, that it holds the rights to what it uploads and that its descriptions and images are accurate.' },
      ],
    },
    {
      id: 'user-content',
      heading: 'Only post what you have the right to post',
      blocks: [
        { p: 'Anything anyone posts on INFLX — a question, a photo, a comment, a store description — stays theirs, and the same rule applies. They keep it, and we get permission to show it where it belongs on the platform.' },
        { p: 'You must actually hold the rights to what you post. If your video uses licensed music, a stock clip, someone else’s footage, or shows a person who has not agreed to appear, that is yours to clear before you submit it. If you cannot clear it, do not submit it. The same goes for anything an AI tool produced in your account.' },
        { p: 'Do not post material that belongs to someone else, that infringes a patent, trademark, copyright or other proprietary right, or that impersonates another person. Doing so can get your content removed and your account suspended, and can expose you personally to a penalty under applicable law.' },
      ],
    },
    {
      id: 'feedback',
      heading: 'Feedback and suggestions',
      blocks: [
        { p: 'If you tell us a feature is broken or suggest something we should build, we may act on it without owing you anything for it and without keeping it confidential.' },
        { p: 'Say so before you send it if you expect otherwise, and do not send us anything you treat as a trade secret. This covers ideas only — it does not touch the content you own.' },
      ],
    },
    {
      id: 'reporting-and-contact',
      heading: 'Reporting infringement, and contacting us',
      blocks: [
        { p: 'If you think someone is using your work without permission, tell us and we will act. Copyright complaints are handled under [Copyright & Takedown](/legal/copyright), which sets out what a valid complaint must contain. For a trademark, design or other complaint, use the same route and describe the right you hold.' },
        { p: 'Questions about this policy, or about what a campaign permission covers, go to {{SUPPORT_EMAIL}} or {{SUPPORT_MOBILE}}. Formal complaints go to our Grievance Officer through [Grievance Redressal](/legal/grievance).' },
        { callout: { label: 'Grievance Officer', p: '{{GRIEVANCE_OFFICER}}, {{GRIEVANCE_DESIGNATION}}\n{{ENTITY}}, {{REGISTERED_ADDRESS}}\n{{GRIEVANCE_EMAIL}} · {{GRIEVANCE_PHONE}}' } },
      ],
    },
  ],
  related: ['copyright', 'terms', 'grievance'],
};

export const copyright = {
  slug: 'copyright',
  title: 'Copyright & Takedown Policy',
  group: 'agreements',
  summary: 'How to report content that infringes your copyright, and what we do about it.',
  appliesTo: 'Rights holders reporting infringement, and anyone whose content has been reported.',
  version: '1.0',
  inShort: 'We respect intellectual property and act on valid complaints. Send us a complete written complaint, we tell the person who posted the material, and we remove content where the complaint stands up. If your content was removed, you can respond.',
  sections: [
    {
      id: 'about-this-policy',
      heading: 'About this policy',
      blocks: [
        { p: 'INFLX is operated by {{ENTITY}}. We respect intellectual property rights and we act on valid complaints about content posted on the platform. This policy takes effect on {{EFFECTIVE_DATE}}.' },
        { p: 'We are an intermediary. We host what our users upload, we do not review every upload before it goes live, and we are not its author. That is why acting properly on a valid complaint matters as much to us as it does to you.' },
        { p: 'The DMCA is United States law and does not apply to INFLX — we act under Indian law. If you have already drafted a DMCA-style notice, check it against the list below and add whatever is missing.' },
      ],
    },
    {
      id: 'what-a-complaint-must-contain',
      heading: 'What a complaint must contain',
      blocks: [
        { p: 'You can complain if you own the copyright in the work, or if you are authorised to act for the owner. A complaint missing any of these cannot be acted on, so please include all six:' },
        { ul: [
          '**1. The work.** Identify the copyrighted work you say has been infringed, with enough detail for us to recognise it.',
          '**2. Where the material is.** The exact location — the full web address, the storefront, the listing, the campaign or the post, and a timestamp for video or audio.',
          '**3. Who you are.** Your full name, postal address, email address and telephone number. If you are an agent, the same details for the rights holder you act for.',
          '**4. Your right.** The basis on which you hold the copyright, or the authority under which you act for the person who does.',
          '**5. That the use is not authorised.** A statement that the use complained of is not authorised by you, by your agent, or by law.',
          '**6. An undertaking on accuracy.** Confirmation that the information is accurate and true to the best of your knowledge, and that you accept responsibility if the claim turns out to be false.',
        ] },
        { p: 'Please complain only if you genuinely believe the use is not authorised. Some uses — criticism, review, reporting and research among them — are lawful without your permission. A complaint used to remove an unflattering review or to shut down a competitor is misuse, and we treat it as misuse.' },
      ],
    },
    {
      id: 'where-to-send-it',
      heading: 'Where to send it',
      blocks: [
        { p: 'Use the complaint form at [Grievance Redressal](/legal/grievance). It asks for each of the six items above in order, so nothing is left out, and it gives your complaint a ticket number you can quote later. That is the fastest route.' },
        { callout: { label: 'Grievance Officer', p: '{{GRIEVANCE_OFFICER}}, {{GRIEVANCE_DESIGNATION}}\n{{ENTITY}}, {{REGISTERED_ADDRESS}}\n{{GRIEVANCE_EMAIL}} · {{GRIEVANCE_PHONE}}' } },
        { p: 'A court order, or a written intimation from a specifically authorised government officer, should go to the same address, clearly marked, so that it is not handled as an ordinary complaint.' },
      ],
    },
    {
      id: 'what-we-do',
      heading: 'What we do about it',
      blocks: [
        { p: 'We acknowledge every complaint within **24 hours** and work to resolve it within **7 days**, in line with applicable law. Some categories of content are removed faster, where the law requires it.' },
        { p: 'We check that the complaint is complete, look at the material at the location you gave us, and tell the person who posted it what has been claimed and by whom. Where the complaint is valid, we remove the material or disable access to it. Where it is weak, or the use looks lawful, we say so and tell you why. Either way you get a written outcome on your ticket.' },
        { p: 'We do not have to be right about the law to act — we are a platform, not a court. Where a claim is genuinely contested, a court is the right forum, and either side can go there.' },
      ],
    },
    {
      id: 'if-your-content-was-removed',
      heading: 'If your content was removed',
      blocks: [
        { p: 'If we take something of yours down over a copyright complaint, we tell you what was removed and what was claimed, unless a court or the law stops us from saying. You can reply on the same ticket.' },
        { p: 'Say what was removed and where it was, why you are entitled to use it, and attach any proof you have — a licence, a receipt, the original file, your raw footage. Include your name, address, email and phone number, and a statement that what you have said is accurate.' },
        { p: 'Access stays disabled for the period applicable law requires. If the complainant produces an order from a competent court in that time, the material stays down until the court says otherwise. If no such order arrives, we can restore it.' },
      ],
    },
    {
      id: 'repeat-infringers',
      heading: 'Repeat infringers, and false claims',
      blocks: [
        { p: 'We keep a record of complaints upheld against an account. A first upheld complaint means the material comes down and you are told why. A pattern of upheld complaints means features can be limited, campaigns paused and payouts held while we look at the account. Persistent infringement means the account is suspended or terminated.' },
        { p: 'We also keep a record of complaints that were not upheld. Knowingly filing a false complaint is reason enough for us to stop accepting complaints from you, and it can carry consequences under the law. Where an offence must be reported to the authorities, we report it.' },
      ],
    },
    {
      id: 'contact',
      heading: 'Questions, and taking it further',
      blocks: [
        { p: 'If you are not sure whether you have a claim, or whether your complaint is complete, write to {{SUPPORT_EMAIL}} or {{SUPPORT_MOBILE}} before you file. It is quicker than a rejected complaint.' },
        { p: 'The full process, including how to escalate if our Grievance Officer’s decision does not satisfy you, is at [Grievance Redressal](/legal/grievance). Going to court instead, or afterwards, stays open to both sides.' },
        { p: 'See also our [Content & Intellectual Property Policy](/legal/content-ip-policy).' },
      ],
    },
  ],
  related: ['content-ip-policy', 'grievance', 'terms'],
};

export const ranking = {
  slug: 'ranking',
  title: 'How Ranking & Recommendations Work',
  group: 'transparency',
  summary: 'How we decide what you see first, what influences it, and what does not.',
  appliesTo: 'Shoppers browsing INFLX, and the brands and creators whose products appear.',
  version: '1.0',
  inShort: 'What you see on INFLX is a mix of rows our team organises, deals creators choose to publish, and what is relevant where you are. Anything paid for is labelled. Paying us more does not move anything up.',
  sections: [
    {
      id: 'why-we-publish-this',
      heading: 'Why we are telling you this',
      blocks: [
        { p: 'When you open INFLX, something is at the top and something is four screens down. That order is not an accident, so you ought to be able to find out how it was decided.' },
        { p: 'We publish this because we think you are owed it. If you read something here that does not match what you see in the app, tell us — the gap is a bug in one of the two, and we want to know which one.' },
      ],
    },
    {
      id: 'what-you-see',
      heading: 'What you are actually looking at',
      blocks: [
        { p: 'What appears on your screen comes from three places at once. Some of it is organised by us — rows and collections our team sets up, each with its own rules about what belongs in it. Some of it is chosen by creators, who publish the deals they want on their own storefronts. And some of it is simply what is relevant to you, mostly the city you are browsing in.' },
        { p: 'Once a row is set up it fills itself from whatever is live and matches, so what you see changes as brands add products, start offers and sell out — even on a day nobody touched anything.' },
      ],
    },
    {
      id: 'what-influences-placement',
      heading: 'What influences what you see',
      blocks: [
        { p: 'In plain language, these are the things that decide whether a product turns up in a row and where:' },
        { ul: [
          'The **category and type** of the product — food, fashion, furniture, beauty and so on.',
          'The **price**, and whether it falls inside the range a row was set up for.',
          'Whether there is an **offer running** on it, and what kind.',
          'Your **city** — rows can be switched on, switched off or filled differently by city.',
          'Whether **our team has featured it** — somebody chose to put it there.',
          'What a **creator has published** to their own storefront.',
          'Whether it is **still available** — live, in stock, and the offer has not ended.',
        ] },
        { p: 'Featured means exactly that and nothing more. It does not mean the brand paid us, and it does not mean we inspected the product or vouch for it.' },
      ],
    },
    {
      id: 'what-does-not-influence',
      heading: 'What does not influence it',
      blocks: [
        { p: 'People assume some of these are levers. None of them are.' },
        { ul: [
          '**Paying us more.** The platform fee a brand pays does not buy position. There is no auction and no way to outbid another brand for a spot.',
          '**Wallet balance or campaign spend.** A brand with a large wallet does not rank above a brand with a small one.',
          '**How much commission a creator earns.** A higher commission does not push a product up for shoppers.',
          '**Who you are.** Your name, gender, age, phone number and payment history are not ranking inputs.',
          '**Anything from outside INFLX.** We do not buy data about you and we do not follow you across other apps and websites.',
          '**Your messages.** Chats, negotiations and support tickets do not feed into this.',
        ] },
        { callout: { label: 'Paid placements are labelled', p: 'If a brand has paid for a position, that position carries a label saying so, wherever it appears. There is no unlabelled paid placement on INFLX. If you ever see one, it is a mistake, and telling us is doing us a favour.' } },
        { p: '**Prices are set by the brand and are the same for everyone who sees that listing.** Nothing on this page changes what you are charged.' },
      ],
    },
    {
      id: 'creator-storefronts',
      heading: 'Creator storefronts work differently',
      blocks: [
        { p: 'A creator’s storefront is not ranked by us. It shows what that creator chose to publish — the deals they accepted and pushed to their own store. If a deal is not there, it is because the creator did not put it there.' },
        { p: 'A creator earns commission on sales that come through their storefront and share links, so they have a reason to publish what they believe their audience will actually buy. That is the incentive, and it is worth reading a storefront with it in mind.' },
        { p: 'A creator posting about a brand they have a paid connection with has to say so on the post itself, clearly and upfront. If you see a post that reads like an ad and carries no label, tell us.' },
      ],
    },
    {
      id: 'ask-us',
      heading: 'Asking about a placement',
      blocks: [
        { p: 'If you are a shopper and a row makes no sense to you, or you are a brand and want to know why your product is not showing, ask. Write to {{SUPPORT_EMAIL}} or {{SUPPORT_MOBILE}} with what you were looking at, and we will tell you what put it there or kept it out.' },
        { p: 'We will not publish the full internal setup of every row — that is how it would get gamed, and a gamed row is worse for you than an opaque one. We will always give you the reason for a specific placement you ask about. To make a formal complaint, use [Grievance Redressal](/legal/grievance).' },
        { p: 'This version takes effect on {{EFFECTIVE_DATE}}. Rows are created, retired and re-tuned constantly and we will not announce each one, but if we start using a new kind of input, or begin selling a kind of placement we do not sell today, this page changes first and says so.' },
      ],
    },
  ],
  related: ['terms', 'privacy', 'grievance'],
};

export default { refunds, ip, copyright, ranking };
