// Support pages — Grievance Redressal, Delete My Account, Contact Us.
//
// These live in the data layer alongside the eleven policy documents rather
// than inside their route files, because the mobile apps need the same text
// and cannot import a React page. One source, three surfaces.

export const grievance = {
  slug: 'grievance',
  title: 'Grievance Redressal',
  group: 'transparency',
  version: '1.0',
  summary: 'How to complain, who handles it, and how fast we must respond.',
  appliesTo:
    'Anyone — you do not need an INFLX account, and you can complain on behalf of someone else.',
  inShort:
    'Tell us what went wrong using the form on this page. We acknowledge every complaint within 24 hours and resolve most within 7 days. Reports of intimate imagery or impersonation are acted on within 2 hours. If we get it wrong, you can escalate.',
  sections: [
    {
      id: 'officer',
      heading: 'Who handles complaints',
      blocks: [
        {
          p: 'Complaints about INFLX — about content on the platform, about an order or payment, or about how we handle your personal data — go to our Grievance Officer.',
        },
        {
          callout: {
            label: 'Grievance Officer',
            p: '{{GRIEVANCE_OFFICER}}, {{GRIEVANCE_DESIGNATION}}\n{{ENTITY}}, {{REGISTERED_ADDRESS}}\n{{GRIEVANCE_EMAIL}} · {{GRIEVANCE_PHONE}}',
          },
        },
        {
          p: 'For everyday help that is not a complaint — an order that has not arrived, a question about a payout — customer care is usually faster: {{SUPPORT_EMAIL}} or {{SUPPORT_MOBILE}}.',
        },
      ],
    },
    {
      id: 'timelines',
      heading: 'What we act on, and how fast',
      blocks: [
        {
          p: 'Different kinds of complaint run on different clocks, and we publish the real ones rather than a single comfortable average.',
        },
        {
          table: {
            head: ['Type of complaint', 'What we do'],
            rows: [
              ['Any complaint', 'Acknowledged within **24 hours**, with a reference number, and resolved within **7 days**'],
              ['Intimate images, or someone impersonating you', 'Treated as urgent and acted on within **2 hours**'],
              ['Other requests to remove content', 'Acted on quickly, and in any case within the timelines the law requires'],
            ],
          },
        },
        {
          p: 'Where we remove content, we keep it and the records about it for as long as the law requires, so that it remains available to a court or an authority.',
        },
      ],
    },
    {
      id: 'after',
      heading: 'What happens after you complain',
      blocks: [
        {
          ul: [
            'We acknowledge your complaint and give you a **reference number**. Keep it.',
            'We look at what you have told us and, where we need it, ask you for anything missing.',
            'We act — remove content, correct a record, process a refund, or explain why we are not doing what you asked.',
            'We tell you the outcome and the reason for it. A complaint that is refused is answered, not ignored.',
          ],
        },
        {
          p: 'We do not need you to prove your case to a legal standard before we act on an urgent report. For the two-hour categories we act first and ask questions afterwards.',
        },
      ],
    },
    {
      id: 'escalate',
      heading: 'If you are not satisfied',
      blocks: [
        {
          p: 'You have two independent routes, and using one does not close the other.',
        },
        {
          table: {
            head: ['Route', 'When', 'How'],
            rows: [
              [
                'Grievance Appellate Committee',
                'If you disagree with our Grievance Officer’s decision, or we missed our deadline',
                'Appeal within **30 days** of our decision. The Committee is established by the Central Government, hears appeals online, and aims to decide within 30 days. Its orders bind us.',
              ],
              [
                'National Consumer Helpline',
                'Any time, including before you contact us',
                'Call **1915** or use consumerhelpline.gov.in, run by the Department of Consumer Affairs.',
              ],
            ],
          },
        },
        {
          p: 'Nothing on this page limits any right you have to approach a consumer forum or a court.',
        },
      ],
    },
    {
      id: 'data',
      heading: 'Complaints about your personal data',
      blocks: [
        {
          p: 'If your complaint is about personal data — you want a copy of what we hold, a correction, or erasure — say so and we will route it accordingly. See the [Privacy Policy](/legal/privacy) for what those rights cover, and [Delete My Account](/account-deletion) if you simply want your account gone.',
        },
      ],
    },
    {
      id: 'raise',
      heading: 'Raise a complaint',
      blocks: [
        {
          p: 'Use the form below. It puts your complaint into the shape we need to act on it quickly, and shows you the deadline your category runs on before you send it.',
        },
      ],
    },
  ],
  related: ['copyright', 'privacy', 'community-guidelines'],
};

export const accountDeletion = {
  slug: 'account-deletion',
  title: 'Delete My Account',
  group: 'transparency',
  version: '1.0',
  summary: 'Erase your INFLX account and the data attached to it.',
  appliesTo: 'Brands, creators and shoppers. You do not need the app installed to ask.',
  inShort:
    'Ask us to delete your INFLX account by email, by phone, or through the form on this site — you do not need the app, and you do not need to be signed in. Deletion is permanent. We erase your profile and activity, and keep only the financial records the law requires us to keep.',
  sections: [
    {
      id: 'before',
      heading: 'Before you delete',
      blocks: [
        {
          p: 'Deletion cannot be undone, and some things are much harder to sort out afterwards. Please check these first.',
        },
        {
          ul: [
            '**Withdraw any balance.** Money left in a wallet is not automatically paid out when an account is deleted.',
            '**Let pending orders finish.** Deleting mid-order removes your ability to track it, return it or claim a refund.',
            '**Close out anything live.** Commission still inside the return window, and campaigns still running, follow the campaign rather than the account.',
          ],
        },
      ],
    },
    {
      id: 'how',
      heading: 'How to delete your account',
      blocks: [
        {
          table: {
            head: ['If you', 'Do this'],
            rows: [
              [
                'By email — the quickest route',
                'Write to {{SUPPORT_EMAIL}} from the email address on your account, or from any address quoting the mobile number you registered with. Put **Delete my account** in the subject line.',
              ],
              [
                'By phone',
                'Call or message {{SUPPORT_MOBILE}} and tell us you want your account deleted.',
              ],
              [
                'Through the complaint form',
                'Use the form at [inflx.in/legal/grievance](/legal/grievance) and choose the personal data option. It works without signing in.',
              ],
            ],
          },
        },
        {
          callout: {
            label: 'No account needed to ask',
            p: 'If you cannot sign in at all, email {{SUPPORT_EMAIL}} with the mobile number you used to register. We will verify your identity another way rather than turning you away.',
          },
        },
      ],
    },
    {
      id: 'what',
      heading: 'What is deleted and what is kept',
      blocks: [
        {
          p: 'We erase everything we can, and keep only what the law requires. We do not keep a shadow copy for our own use.',
        },
        {
          table: {
            head: ['Data', 'What happens'],
            rows: [
              ['Your profile, addresses and saved preferences', '**Deleted**'],
              ['Your content, storefront and listings', '**Removed from the platform**'],
              ['Notification settings and device details', '**Deleted**'],
              ['Payment card details', 'We never held these — they sit with our payment partner.'],
              ['Bank or UPI payout details', '**Deleted** once no payout is outstanding'],
              [
                'Orders, invoices, commission and payout records',
                '**Retained**, because tax and company law requires us to keep financial records. They are kept for that purpose only.',
              ],
            ],
          },
        },
      ],
    },
    {
      id: 'when',
      heading: 'How long it takes',
      blocks: [
        {
          p: 'Deletion started in the app takes effect straight away for sign-in, and we complete it across our systems within a reasonable period after that. A request sent by email is acknowledged within **24 hours** and actioned once we have verified who you are.',
        },
        {
          p: 'If something blocks deletion — an open dispute, a pending payout, an unfulfilled order — we tell you what it is and what has to happen first, rather than silently doing nothing.',
        },
      ],
    },
    {
      id: 'less',
      heading: 'If you want less than full deletion',
      blocks: [
        {
          p: 'Deleting the account is the biggest hammer available, and it is often not what someone actually wants.',
        },
        {
          ul: [
            'To correct something wrong on your profile, edit it in the app — no request needed.',
            'To stop notifications, turn them off in **Settings** rather than deleting the account.',
            'To get a copy of your data, or to have specific information corrected or erased, ask via [Grievance Redressal](/legal/grievance).',
          ],
        },
      ],
    },
  ],
  related: ['privacy', 'terms'],
};

export const contact = {
  slug: 'contact',
  title: 'Contact Us',
  group: 'transparency',
  version: '1.0',
  summary: 'Customer care, the Grievance Officer, and our registered office.',
  appliesTo: 'Everyone.',
  inShort:
    'For anything ordinary, customer care is fastest. For a formal complaint, use the Grievance Officer route — it runs on published deadlines.',
  sections: [
    {
      id: 'company',
      heading: 'The company behind INFLX',
      blocks: [
        {
          p: 'INFLX is operated by **{{ENTITY}}**, a company incorporated in India.',
        },
        {
          table: {
            head: ['Detail', 'Value'],
            rows: [
              ['Legal name', '{{ENTITY}}'],
              ['CIN', '{{CIN}}'],
              ['Registered office', '{{REGISTERED_ADDRESS}}'],
              ['Website', 'https://inflx.in'],
            ],
          },
        },
      ],
    },
    {
      id: 'care',
      heading: 'Customer care',
      blocks: [
        {
          p: 'Use this for orders, bookings, refunds, listings, campaigns, payouts and account questions.',
        },
        {
          table: {
            head: ['Channel', 'Detail'],
            rows: [
              ['Email', '{{SUPPORT_EMAIL}}'],
              ['Phone', '{{SUPPORT_MOBILE}}'],
            ],
          },
        },
        {
          p: 'The fastest route for anything about a specific order or campaign is the help option inside the app, because it carries the reference we need with it.',
        },
      ],
    },
    {
      id: 'grievance',
      heading: 'Formal complaints',
      blocks: [
        {
          p: 'A complaint to the Grievance Officer runs on published deadlines — acknowledged within **24 hours**, resolved within **7 days**, and within **2 hours** for reports of intimate imagery or impersonation.',
        },
        {
          callout: {
            label: 'Grievance Officer',
            p: '{{GRIEVANCE_OFFICER}}, {{GRIEVANCE_DESIGNATION}}\n{{GRIEVANCE_EMAIL}}\nUse the form at [inflx.in/legal/grievance](/legal/grievance) so nothing needed is missing.',
          },
        },
      ],
    },
    {
      id: 'specific',
      heading: 'Reaching the right team',
      blocks: [
        {
          table: {
            head: ['If you want to', 'Go here'],
            rows: [
              ['Report content that should not be on INFLX', '[Grievance Redressal](/legal/grievance)'],
              ['Report copyright or trade mark infringement', '[Copyright & Takedown](/legal/copyright)'],
              ['Delete your account', '[Delete My Account](/account-deletion)'],
              ['Ask about your personal data', '[Privacy Policy](/legal/privacy)'],
              ['Understand why something ranks where it does', '[How Ranking Works](/legal/ranking)'],
              ['List your business on INFLX', 'Register at [inflx.in](/login)'],
            ],
          },
        },
      ],
    },
  ],
  related: ['privacy', 'terms', 'refunds'],
};

export default { grievance, accountDeletion, contact };
