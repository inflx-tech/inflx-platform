// Creator Agreement, Brand Agreement, Advertising & Sponsored Content Disclosure — INFLX legal content.
// Prose is data; the renderer at app/legal/[slug]/page.js turns it into HTML.

export const creator = {
  slug: 'creator-agreement',
  title: 'Creator Agreement',
  group: 'agreements',
  summary: 'The rules for creators — offers, content, disclosure, commission and payouts.',
  appliesTo: 'Every creator who accepts a campaign offer or earns commission on INFLX.',
  version: '1.0',
  inShort:
    'You make content for brands through INFLX and get paid for it. Deliver what you agreed, label paid posts clearly, and keep your payout details current. Commission you earn is held until the return window on that sale closes, and then paid out.',
  sections: [
    {
      id: 'who-this-covers',
      heading: 'Who this covers and your account',
      blocks: [
        {
          p: 'This agreement is between you and {{ENTITY}} (CIN {{CIN}}), registered at {{REGISTERED_ADDRESS}}, which operates INFLX. It applies from the moment you create a creator account, and again every time you accept a campaign offer. It takes effect on {{EFFECTIVE_DATE}}.',
        },
        {
          p: 'It adds to our [Terms of Use](/legal/terms), which cover everything else you do on INFLX. You must be at least 18 and able to enter a contract under Indian law. One person, one account.',
        },
        {
          ul: [
            'Give us accurate details and keep them current.',
            'Do not let anyone else use your account, and do not open a second account to get around a suspension.',
            'Keep your payout details accurate. We pay to the details on file.',
          ],
        },
      ],
    },
    {
      id: 'campaign-offers',
      heading: 'How campaign offers work',
      blocks: [
        {
          p: 'Brands build campaigns and invite creators. When a brand invites you, the offer arrives in your account with the deliverables, the fee, any commission and the dates.',
        },
        {
          p: 'You can accept, negotiate or decline. An offer lapses if you do not respond within the window shown on it. Nothing binds either side until both you and the brand have signed inside INFLX — and once you have signed, deliver what the offer says.',
        },
        {
          callout: {
            label: 'Keep the deal inside INFLX',
            p: 'Negotiate, brief and approve on the platform. If money or instructions move off INFLX we cannot see them, we cannot release campaign funds against them, and we cannot help you if the deal goes wrong.',
          },
        },
      ],
    },
    {
      id: 'your-content',
      heading: 'Your content and the licence you give',
      blocks: [
        {
          p: 'You own what you create. Signing an offer does not transfer your copyright to us or to the brand. The content must be your own work, or work you hold the rights to use — including music, fonts, footage and photographs.',
        },
        {
          p: 'You give us a licence to host, store, display and adapt your campaign content so that INFLX works — on your storefront, in the brand dashboard, in share links and in the apps. We may show your name, handle and profile picture alongside it. We do not sell your content to third parties.',
        },
        {
          p: 'You also give the brand a licence to use the content for the purpose, channels and period written in the signed offer. If the offer is silent, the brand may use it on its own INFLX pages only. Anything wider needs a fresh agreement with you.',
        },
      ],
    },
    {
      id: 'disclosure',
      heading: 'Disclosing paid work and AI content',
      blocks: [
        {
          p: 'If a brand gave you anything of value — money, free product, a discount, a gift, a trip, a barter — or you have a business or personal connection to it, you must say so clearly in the post itself. This applies even if nobody asked you to mention the product, and even if you genuinely like it.',
        },
        {
          p: 'Put the label where people will actually see it, at the start, not buried among hashtags. How to label a post properly is set out in our [Advertising and Sponsored Content Disclosure](/legal/advertising-disclosure). Follow it — it is a legal duty, not a platform preference.',
        },
        {
          p: 'Your opinion must be genuine, reasonably current, and based on real experience of the product. Do not make a claim the brand has not given you evidence for, and do not post anything prohibited by our [Community Guidelines](/legal/community-guidelines).',
        },
        {
          p: 'If an image, video or audio you post was generated or meaningfully altered by AI, declare it. Ordinary cropping, colour correction and standard filters do not need a declaration. Where we label AI-declared content, do not strip, crop out or cover that label.',
        },
      ],
    },
    {
      id: 'commission-and-payouts',
      heading: 'Commission and payouts',
      blocks: [
        {
          p: 'Some offers pay commission on sales. When a shopper reaches a brand through your storefront or your share link and buys, the sale is attributed to you and you earn commission on it. The commission terms that apply are shown to you before you accept an offer.',
        },
        {
          p: 'Commission is held until the return window on that order closes. If the order is returned, cancelled or refunded within that window, the commission is reversed. What is held and what is ready to pay out is shown in your wallet.',
        },
        {
          p: 'You withdraw to a UPI ID or a bank account you have added and verified. Payouts are made net of tax deducted at source, as required by law, and a minimum withdrawal amount applies — the current figure is shown in your wallet. Give us a valid PAN, and your GSTIN if you are registered; we may hold a payout until they are on file.',
        },
        {
          p: 'You handle your own taxes, registration, invoicing and filings. We do not gross up your fee to cover them. Paid collaborations on INFLX are advertising and brand promotion services — describe them that way on your invoices.',
        },
      ],
    },
    {
      id: 'your-status',
      heading: 'You are an independent contractor',
      blocks: [
        {
          p: 'You are an independent contractor. This agreement does not make you our employee, partner, agent or joint venturer, and it does not make you an employee of any brand you work with.',
        },
        {
          ul: [
            'You decide how and when you do the work, within the deadlines you agreed.',
            'You get no salary, leave, provident fund, gratuity or insurance from us.',
            'You are free to work with other brands and other platforms, unless the signed offer contains an exclusivity term you agreed to.',
            'You bear your own costs — equipment, data, travel, studio time — unless the offer says the brand covers them.',
          ],
        },
        {
          p: 'You are responsible for what you post. If a claim is made against us because of your content, we can recover from you what it cost us to deal with it.',
        },
      ],
    },
    {
      id: 'suspension-and-termination',
      heading: 'Suspension and termination',
      blocks: [
        {
          p: 'You can close your creator account whenever you want. Campaigns you have already signed still have to be completed, and commission already earned still moves through the normal cycle.',
        },
        {
          p: 'We can suspend or end your account if you break this agreement, the [Community Guidelines](/legal/community-guidelines) or the law. The usual reasons are these.',
        },
        {
          ul: [
            'Repeatedly missing deadlines, or abandoning campaigns you signed.',
            'Posting paid content without a clear label, after we have told you once.',
            'Faking engagement, clicks or orders to inflate commission.',
            'Posting content that is prohibited by law or by our guidelines.',
            'Giving us false identity, PAN or payout details.',
          ],
        },
        {
          p: 'Where we can, we warn you first and give you a chance to fix it. Where the law requires immediate removal, we act first and tell you after. If we end your account for fraud, we can withhold commission that came out of that fraud. Unlawful content can also attract penalty or punishment on you personally under applicable Indian law.',
        },
      ],
    },
    {
      id: 'grievance',
      heading: 'Contact us and raise a grievance',
      blocks: [
        {
          p: 'If something goes wrong, raise it with us first. Use the complaint form on our [Grievance Redressal](/legal/grievance) page — it asks for the details we need in order to act. General support is on {{SUPPORT_EMAIL}} and {{SUPPORT_MOBILE}}.',
        },
        {
          callout: {
            label: 'Grievance Officer',
            p: '{{GRIEVANCE_OFFICER}}, {{GRIEVANCE_DESIGNATION}}\n{{ENTITY}}, {{REGISTERED_ADDRESS}}\n{{GRIEVANCE_EMAIL}} · {{GRIEVANCE_PHONE}}',
          },
        },
        {
          p: 'We acknowledge complaints **within 24 hours** and work to resolve them **within 7 days**, in line with applicable law. The full process, including how to escalate, is at [Grievance Redressal](/legal/grievance).',
        },
        {
          p: 'This agreement is governed by Indian law, and the courts at {{JURISDICTION_CITY}} have jurisdiction. We publish changes to it on this page with a new effective date.',
        },
      ],
    },
  ],
  related: ['advertising-disclosure', 'community-guidelines', 'grievance'],
};

export const brand = {
  slug: 'brand-agreement',
  title: 'Brand Agreement',
  group: 'agreements',
  summary: 'The rules for brands — listings, pricing, campaigns, and what you owe creators and shoppers.',
  appliesTo: 'Every business with a brand account on INFLX.',
  version: '1.0',
  inShort:
    'You list real products at honest prices, fund a campaign in full before it goes live, and treat creators and shoppers fairly. You are responsible for your products, your fulfilment and your own advertising compliance. A platform fee set by INFLX is charged to you on top of what you spend, and shown before you are charged.',
  sections: [
    {
      id: 'who-this-covers',
      heading: 'Who this covers and getting approved',
      blocks: [
        {
          p: 'This agreement is between your business and {{ENTITY}} (CIN {{CIN}}), registered at {{REGISTERED_ADDRESS}}, which operates INFLX. It applies from the moment you create a brand account and for as long as you keep one. It takes effect on {{EFFECTIVE_DATE}}, and adds to our [Terms of Use](/legal/terms).',
        },
        {
          p: 'You must be a registered business, or a person carrying on a lawful business in India, and able to enter a contract. Whoever signs up must be authorised to bind the business. Brand accounts are reviewed before they go live, and we may ask for your business registration, PAN, GSTIN and proof of address. We can refuse or withdraw approval, and we will tell you why.',
        },
        {
          ul: [
            'Keep your business name, address, tax details and contact details accurate and current.',
            'Tell us if your ownership, legal name or registered address changes.',
            'You are responsible for everything done under your account, including by your staff and your agencies.',
          ],
        },
      ],
    },
    {
      id: 'listings-and-pricing',
      heading: 'Your listings and your prices',
      blocks: [
        {
          p: '**Your listings must match what you actually sell.** Descriptions, images, sizes, quantities, materials and inclusions have to be correct, and you honour the prices and offers you publish. A shopper has to be able to rely on what your page says.',
        },
        {
          p: 'Show the **total price as a single figure**, with a breakup of what makes it up. No charge may appear for the first time at checkout — delivery, packing, handling and convenience charges must be shown upfront. Show every declaration your category requires.',
        },
        {
          p: 'Design honestly as well as describing honestly: no misleading urgency, no hidden charges, and no pre-ticked add-ons. Do not post fake reviews or have anyone review your product while posing as an ordinary shopper.',
        },
        {
          p: 'If you find a listing is wrong, correct it. If an order has already been placed against the wrong information, tell the shopper and offer a cancellation or a full refund.',
        },
      ],
    },
    {
      id: 'campaigns-and-creators',
      heading: 'Campaigns, funding and creators',
      blocks: [
        {
          p: 'You create a campaign, set the deliverables and the budget, and invite creators. **Your wallet must hold the full budget before the campaign can be published.** We do not extend credit and we do not publish part-funded campaigns.',
        },
        {
          p: 'Once a creator signs, the money is held and released in stages set by INFLX — the stages that apply are shown on the campaign before you fund it. A platform fee set by INFLX is charged to you on top of what you spend; the rate that applies to your account is shown in your wallet before you are charged, and we tell you in advance if it changes.',
        },
        {
          ul: [
            'Give a clear brief, and give it once. Do not change the deliverable after signing without agreeing a new fee and new dates.',
            'Review submitted content within the window written in the offer, and do not stall a release the creator is waiting on.',
            'Give the creator evidence for any claim you want made about your product. If you cannot back it, do not ask for it.',
            '**Never ask a creator to hide or leave out the fact that the collaboration is paid**, and never ask for a fake review.',
          ],
        },
        {
          p: 'Creators are independent contractors. They are not your employees, and they are not ours.',
        },
      ],
    },
    {
      id: 'advertising-law',
      heading: 'Your own advertising responsibility',
      blocks: [
        {
          p: "The duty to disclose a paid collaboration sits on **both** of you — you as the advertiser and the creator as the endorser. You cannot treat it as only the creator's problem, and a brand that asks a creator to leave the label out is committing a separate wrong of its own.",
        },
        {
          p: 'Check the posts made for your campaign. **If a post about your brand is not labelled clearly, you must call on the creator to edit or delete it.** Tell us as well, so we can act on our side.',
        },
        {
          p: "Endorsements must reflect the creator's genuine and reasonably current opinion, based on real experience with what you sell or adequate information about it. Do not script an opinion the creator does not hold.",
        },
        {
          p: 'The labelling rules are in our [Advertising and Sponsored Content Disclosure](/legal/advertising-disclosure). Send it to your agency and to every creator you work with.',
        },
      ],
    },
    {
      id: 'fulfilment-returns-refunds',
      heading: 'Fulfilment, returns and refunds',
      blocks: [
        {
          p: '**You are responsible for your products and services.** INFLX is a platform, not the seller. Quality, availability, delivery, warranty, returns and refunds are yours, on the terms you publish.',
        },
        {
          p: 'Deliver in the time you promised, honour the slot you sold, and serve the pre-book you accepted. If you cannot, tell the shopper as soon as you know and refund in full.',
        },
        {
          ul: [
            'Publish your return, refund, exchange, warranty and delivery terms, and honour the terms you published.',
            'Refunds go back through the original payment route, through our payment partner.',
            'Where a shopper pays at your counter, the order still exists on INFLX and these same terms apply to it.',
            'Commission earned by a creator on an order is reversed if that order is returned, cancelled or refunded within the return window.',
          ],
        },
        {
          p: 'Payments run through a third-party payment partner. We never store complete card details.',
        },
      ],
    },
    {
      id: 'prohibited-products',
      heading: 'What you cannot list',
      blocks: [
        {
          p: 'Some things cannot be listed on INFLX, whatever licence you may hold elsewhere.',
        },
        {
          ul: [
            'Anything whose sale is restricted or banned under Indian law, or which needs a licence you do not hold.',
            "Counterfeit goods, or goods that infringe someone else's trademark, copyright, patent or design.",
            'Drugs, tobacco products, weapons, and any product marketed for an unproven medical effect.',
            'Live animals, human tissue, and anything derived from a protected species.',
            'Anything obscene, anything that sexualises or endangers a child, and anything relating to gambling or money laundering.',
          ],
        },
        {
          p: 'If you sell in a licensed category — food, drugs and cosmetics, weights and measures, hospitality — hold the licence, keep it current, and give us the number when we ask for it.',
        },
      ],
    },
    {
      id: 'suspension-and-termination',
      heading: 'Suspension and termination',
      blocks: [
        {
          p: 'You can close your brand account. Campaigns already signed must be completed, orders already placed must be fulfilled, and campaign money already held is released or returned according to what has actually happened.',
        },
        {
          p: 'We can suspend or end your account if you break this agreement or the law. The usual reasons are these.',
        },
        {
          ul: [
            'Listings that do not match what you deliver, after we have told you once.',
            'Charges appearing at checkout that were never shown upfront.',
            'Asking creators to conceal a paid relationship, or to post fake reviews.',
            'Not fulfilling orders, or not refunding when a refund is owed.',
            'Not funding a campaign you have committed to.',
          ],
        },
        {
          p: 'Where we can, we warn you first and give you a chance to fix it. Where the law requires immediate removal, we act first and tell you after. A suspension does not cancel what you already owe to creators or to shoppers, and unlawful listings can attract penalty or punishment on you directly under applicable Indian law.',
        },
      ],
    },
    {
      id: 'grievance',
      heading: 'Contact us and raise a grievance',
      blocks: [
        {
          p: 'Raise anything that goes wrong with us first. Use the complaint form on our [Grievance Redressal](/legal/grievance) page — it asks for the details we need in order to act. General support is on {{SUPPORT_EMAIL}} and {{SUPPORT_MOBILE}}.',
        },
        {
          callout: {
            label: 'Grievance Officer',
            p: '{{GRIEVANCE_OFFICER}}, {{GRIEVANCE_DESIGNATION}}\n{{ENTITY}}, {{REGISTERED_ADDRESS}}\n{{GRIEVANCE_EMAIL}} · {{GRIEVANCE_PHONE}}',
          },
        },
        {
          p: 'We acknowledge complaints **within 24 hours** and work to resolve them **within 7 days**, in line with applicable law. Shopper complaints about your listings and orders come to you through the same route, and we expect you to answer them just as promptly.',
        },
        {
          p: 'This agreement is governed by Indian law, and the courts at {{JURISDICTION_CITY}} have jurisdiction. We publish changes to it on this page with a new effective date.',
        },
      ],
    },
  ],
  related: ['creator-agreement', 'advertising-disclosure', 'grievance'],
};

export const advertising = {
  slug: 'advertising-disclosure',
  title: 'Advertising & Sponsored Content Disclosure',
  group: 'agreements',
  summary: 'How to label paid posts on INFLX — what counts as a paid connection, which labels to use, and where they must appear.',
  appliesTo: 'Creators who post about brands, and the brands who pay them. Shoppers can use it to check whether a post was declared.',
  version: '1.0',
  inShort:
    'If a brand gave you anything of value, say so in the post itself, in plain sight, using a clear label. You must do this even if nobody asked you to mention the product, and even if you truly like it. Both the brand and the creator answer for a missing label.',
  sections: [
    {
      id: 'why-this-exists',
      heading: 'Why disclosure matters',
      blocks: [
        {
          p: 'A shopper judges a recommendation differently once they know it was paid for. Hiding the payment takes that judgement away from them. That is why disclosure is required by law in India, and why we enforce it on INFLX.',
        },
        {
          p: 'This page applies to every post made through an INFLX campaign, and to any post about a brand you have a connection with, wherever you publish it. It takes effect on {{EFFECTIVE_DATE}}.',
        },
      ],
    },
    {
      id: 'material-connection',
      heading: 'What counts as a paid connection',
      blocks: [
        {
          p: 'A paid connection is anything of value that passes between you and a brand, or any relationship a viewer would want to know about. It is far wider than cash.',
        },
        {
          ul: [
            'Money for the post.',
            'Free product — including product that turned up unsolicited.',
            'A discount, a special price, a gift, a hamper or a seeding box.',
            'Entry into a contest or a giveaway.',
            'A trip, a hotel stay or an event invitation.',
            'A barter — product or service against coverage.',
            'Commission you earn on sales, through a link or your storefront.',
            'Any business or personal relationship — a job, a retainer, a stake in the brand, or a family tie.',
          ],
        },
        {
          p: 'Something you bought yourself, at full price, with no arrangement, does not count. If you are unsure, disclose — nobody is penalised for labelling a post that did not strictly need it.',
        },
      ],
    },
    {
      id: 'labelling-your-post',
      heading: 'How to label the post',
      blocks: [
        {
          p: 'The label must be **clear and visible** — at the start of the post, where a viewer sees it before they engage with the content. On an image or a video, put it on the visual itself, large enough to read on a phone.',
        },
        {
          p: 'A label only in your bio, only at the end of a long caption, hidden behind a "more" click, or buried among hashtags is not disclosure. Where the platform gives you a paid-partnership tool, switch it on as well.',
        },
        {
          p: 'Use wording that plainly says the post is paid for. Commonly accepted labels include:',
        },
        {
          ul: [
            '**Advertisement** or **Ad** — the post is a paid advertisement.',
            '**Sponsored** — the brand paid for the post.',
            '**Collaboration** or **Partnership** — you and the brand worked together, or have an ongoing arrangement.',
            '**Affiliate** — you earn commission on sales through your links or storefront.',
            "The platform's own paid-partnership tag, such as Instagram's **Paid Partnership** or YouTube's **Includes Paid Promotion**.",
          ],
        },
        {
          p: 'Write the label in the language of your post. Wording you invent — "thanks to", "in association with" — does not do the job, because it does not tell the viewer the post was paid for.',
        },
      ],
    },
    {
      id: 'when-disclosure-is-needed',
      heading: 'When you must disclose',
      blocks: [
        {
          p: 'Disclose **even if the brand never asked you to mention the product**. The duty comes from the connection, not from the instruction. Disclose **even if the opinion is genuinely your own** — liking something you were given does not remove the connection.',
        },
        {
          ul: [
            'On every post in a campaign, not only the first one.',
            'On reposts, on short cuts taken from a longer video, and on stories that repeat the content.',
            'On affiliate content, and on your INFLX storefront listings where you earn commission.',
          ],
        },
        {
          p: 'Your opinion also has to be real. It must be what you actually think, reasonably current, and based on real experience with the product or adequate information about it.',
        },
      ],
    },
    {
      id: 'who-is-responsible',
      heading: 'Who is responsible',
      blocks: [
        {
          p: 'Both the brand and the creator are responsible. Neither can point at the other and walk away.',
        },
        {
          table: {
            head: ['Who', 'What they must do'],
            rows: [
              ['The creator', 'Label the post clearly, place the label where it will be seen, and keep the opinion genuine.'],
              ['The brand', 'Tell the creator that disclosure is required, check the posts, and call on the creator to edit or delete a post that is not compliant.'],
              ['INFLX', 'Publish these rules, act on what is reported to us, and remove or restrict content that stays non-compliant.'],
            ],
          },
        },
        {
          p: 'A brand that asks a creator to leave the label out is not shifting the risk onto the creator — it is committing a separate wrong of its own. If a brand asks you to do that, refuse and tell us. Undisclosed advertisements can attract penalties on both sides under applicable Indian law.',
        },
      ],
    },
    {
      id: 'what-we-do',
      heading: 'What we do about a non-compliant post',
      blocks: [
        {
          p: 'When we learn that a post made through INFLX is not disclosed properly, we would much rather it got fixed than punish anyone. We tell the creator and the brand what is wrong and ask for an edit.',
        },
        {
          p: 'If it is not fixed, we can hide the deal from the creator storefront, pause the campaign and stop the next release of campaign funds. If it keeps happening, we can suspend the account and withhold commission earned from the non-compliant posts.',
        },
        {
          p: 'Where the law requires content to come down, we act on that timeline instead and tell you afterwards. What may not be posted at all is covered by our [Community Guidelines](/legal/community-guidelines); the payment consequences are in the [Creator Agreement](/legal/creator-agreement).',
        },
      ],
    },
    {
      id: 'report-an-undisclosed-ad',
      heading: 'Report an undisclosed advertisement, or contact us',
      blocks: [
        {
          p: 'If you have seen a post on INFLX that looks paid for but carries no label, tell us. You do not need an account, and you do not need to be the person affected.',
        },
        {
          ul: [
            'Use the complaint form on our [Grievance Redressal](/legal/grievance) page. It asks for the link, the brand and what you noticed — the details we need in order to act.',
            'Write to {{GRIEVANCE_EMAIL}} if you would rather use email.',
            'General support is on {{SUPPORT_EMAIL}} and {{SUPPORT_MOBILE}}.',
          ],
        },
        {
          p: 'We acknowledge complaints **within 24 hours** and work to resolve them **within 7 days**, in line with applicable law.',
        },
        {
          callout: {
            label: 'Grievance Officer',
            p: '{{GRIEVANCE_OFFICER}}, {{GRIEVANCE_DESIGNATION}}\n{{ENTITY}}, CIN {{CIN}}, {{REGISTERED_ADDRESS}}\n{{GRIEVANCE_EMAIL}} · {{GRIEVANCE_PHONE}}',
          },
        },
      ],
    },
  ],
  related: ['creator-agreement', 'brand-agreement', 'community-guidelines'],
};

export default { creator, brand, advertising };
