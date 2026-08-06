// Core policies (Privacy, Terms, Cookies, Community Guidelines) — INFLX legal content.
// Prose is data; the renderer at app/legal/[slug]/page.js turns it into HTML.

export const privacy = {
  slug: 'privacy',
  title: 'Privacy Policy',
  group: 'policies',
  summary: 'What information we collect, how we use it, and the choices you have.',
  appliesTo: 'Everyone who uses INFLX — brands, creators and shoppers.',
  version: '1.0',
  inShort: 'We collect the information we need to operate the platform and process transactions. We do not sell your personal information. You can ask to access, correct or delete your information, and you can contact our Grievance Officer if something goes wrong.',
  sections: [
    {
      id: 'about-this-policy',
      heading: 'About this policy',
      blocks: [
        { p: 'INFLX is operated by {{ENTITY}} (CIN {{CIN}}), with its registered office at {{REGISTERED_ADDRESS}}. This policy explains how we collect, use and protect personal information across the INFLX website and mobile applications. It takes effect on {{EFFECTIVE_DATE}}.' },
        { p: 'By using INFLX, you agree to this policy. Please read it together with our [Terms of Use](/legal/terms) and our [Cookie Policy](/legal/cookies).' },
      ],
    },
    {
      id: 'information-we-collect',
      heading: 'Information we collect',
      blocks: [
        { p: 'We collect information that you provide to us, information generated when you use the platform, and information we receive from service providers acting on our behalf.' },
        {
          ul: [
            '**Account information** — such as your name, mobile number, email address, city, and the business or creator profile details you provide.',
            '**Transaction information** — such as orders, bookings, campaigns, offers, payments, commissions and payouts.',
            '**Content** you upload, publish or submit on the platform.',
            '**Payment information** — processed by our payment partner. We do not store complete card details.',
            '**Technical information** — such as device type, application version, IP address and usage activity.',
            '**Location information**, where you choose to share it.',
            '**Communications** with us, including support requests, feedback and complaints.',
          ],
        },
        { p: 'We collect only what we reasonably need for the purposes described in this policy.' },
      ],
    },
    {
      id: 'how-we-use-information',
      heading: 'How we use information',
      blocks: [
        { p: 'We use personal information for the following purposes.' },
        {
          ul: [
            'To create and manage your account, and to verify your identity.',
            'To operate, maintain and improve the platform and its features.',
            'To process transactions, payments, commissions, payouts and applicable taxes.',
            'To organise and personalise the content and offers shown to you.',
            'To communicate with you about your account, transactions and service updates.',
            'To detect, prevent and investigate fraud, misuse and security incidents.',
            'To comply with applicable laws and to respond to lawful requests.',
          ],
        },
        { p: 'We may use automated tools, including artificial intelligence, to support these purposes. We do not sell your personal information, and we do not use it for third-party advertising.' },
      ],
    },
    {
      id: 'cookies',
      heading: 'Cookies and similar technologies',
      blocks: [
        { p: 'We use cookies and similar technologies to keep you signed in, remember your preferences, and understand how the platform is used.' },
        { p: 'You can manage cookies through your browser or device settings. Our [Cookie Policy](/legal/cookies) explains this in more detail.' },
      ],
    },
    {
      id: 'how-we-share-information',
      heading: 'How we share information',
      blocks: [
        { p: 'We share personal information only as described below, and only to the extent necessary.' },
        {
          ul: [
            '**Service providers** who help us operate the platform, including payment, hosting, communication and analytics providers.',
            '**Other users**, where a transaction requires it — for example, a brand and a creator working on the same campaign, or a brand fulfilling an order.',
            '**Professional advisers**, such as auditors and legal advisers.',
            '**Authorities**, where disclosure is required by law or by a valid legal request.',
            '**A successor entity**, in connection with a merger, acquisition or reorganisation.',
          ],
        },
        { p: '**We do not sell your personal information.** Service providers act on our instructions and are required to protect the information we share with them.' },
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep information',
      blocks: [
        { p: 'We keep personal information for as long as it is needed for the purposes described in this policy, and for as long as required by applicable law.' },
        { p: 'Financial and transaction records are retained for the periods prescribed by tax and company law, and content removed following a complaint or a legal order is retained for the period required under applicable law. When information is no longer needed, we delete it or remove the details that identify you.' },
      ],
    },
    {
      id: 'security',
      heading: 'Security',
      blocks: [
        { p: 'We follow reasonable security practices and procedures designed to protect personal information against unauthorised access, disclosure, alteration and loss.' },
        { p: 'No method of transmission or storage is completely secure. Please keep your account details and one-time passwords confidential — we will never ask you for a one-time password.' },
      ],
    },
    {
      id: 'your-rights',
      heading: 'Your rights and choices',
      blocks: [
        { p: 'Subject to applicable law, you may:' },
        {
          ul: [
            'Request access to the personal information we hold about you.',
            'Request that inaccurate or incomplete information be corrected or updated.',
            'Request deletion of your personal information, and close your account.',
            'Withdraw consent where we rely on it, at any time.',
            'Nominate another person to exercise your rights on your behalf.',
            'Raise a complaint with our Grievance Officer.',
          ],
        },
        { p: 'To make a request, write to {{GRIEVANCE_EMAIL}} or use the options available in the app. We may verify your identity before acting on a request. Some information may be retained where we are required or permitted by law to keep it. You can also close your account at [Delete My Account](/account-deletion).' },
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      blocks: [
        { p: 'INFLX is intended for users aged 18 and above. We do not knowingly collect personal information from children.' },
        { p: 'We do not track children or direct advertising at them. If you believe a child has provided personal information to us, please contact us and we will take appropriate steps to remove it.' },
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      blocks: [
        { p: 'We may update this policy from time to time. When we do, we will publish the revised version on this page with a new effective date.' },
        { p: 'Where changes are significant, we will notify you through the platform or by other means before they take effect.' },
      ],
    },
    {
      id: 'contact-and-grievance',
      heading: 'Contact us',
      blocks: [
        { p: 'For questions about this policy or about your personal information, contact us at {{SUPPORT_EMAIL}} or {{SUPPORT_MOBILE}}.' },
        { callout: { label: 'Grievance Officer', p: '{{GRIEVANCE_OFFICER}}, {{GRIEVANCE_DESIGNATION}}\n{{ENTITY}}, {{REGISTERED_ADDRESS}}\n{{GRIEVANCE_EMAIL}} · {{GRIEVANCE_PHONE}}' } },
        { p: 'We acknowledge complaints within **24 hours** and work to resolve them within **7 days**, in line with applicable law. The full process is at [Grievance Redressal](/legal/grievance).' },
      ],
    },
  ],
  related: ['cookies', 'terms', 'grievance'],
};

export const terms = {
  slug: 'terms',
  title: 'Terms of Use',
  group: 'policies',
  summary: 'The agreement between you and us — who can use INFLX, what you may and may not do, and how money and disputes work.',
  appliesTo: 'Everyone who uses INFLX — brands, creators and shoppers.',
  version: '1.0',
  inShort: 'INFLX connects brands, creators and shoppers. You must be 18 to use it. You are responsible for what you post and sell; we provide the platform, we are not the seller. If you break these terms, we can remove content or close your account.',
  sections: [
    {
      id: 'what-this-covers',
      heading: 'What this covers',
      blocks: [
        { p: 'These terms are the agreement between you and {{ENTITY}} (CIN {{CIN}}), registered at {{REGISTERED_ADDRESS}}, which operates INFLX. They apply to the INFLX website and apps, and to everything you do on them. This version takes effect on {{EFFECTIVE_DATE}}.' },
        { p: 'By creating an account or using INFLX, you accept these terms. Our [Privacy Policy](/legal/privacy), [Cookie Policy](/legal/cookies) and [Community Guidelines](/legal/community-guidelines) are part of this agreement.' },
        { p: 'If you sign a separate agreement with us for your role as a brand or a creator, that agreement adds to these terms and, on anything specific to your role, takes precedence.' },
      ],
    },
    {
      id: 'who-can-use-inflx',
      heading: 'Who can use INFLX, and your account',
      blocks: [
        { p: 'You must be **18 or older** to use INFLX. If you are signing up for a business, you must have the authority to act for that business.' },
        { p: 'You sign in with your mobile number and a one-time password. There is no password to set, so anyone who can receive that one-time password can reach your account. Keep your number and device secure, and never share an OTP with anyone. Activity from your account is treated as yours.' },
        { p: 'One person or business, one account. Do not create extra accounts to get around a limit or a suspension. We may review a brand or creator account before it can transact, ask for more information, or withdraw approval if the information given to us turns out to be inaccurate.' },
      ],
    },
    {
      id: 'the-three-roles',
      heading: 'The three sides of INFLX',
      blocks: [
        { p: 'INFLX has three kinds of user. What you agree to depends on which one you are.' },
        {
          table: {
            head: ['Role', 'What you can do', 'What you agree to'],
            rows: [
              ['Brand', 'List products and services, run campaigns, invite creators, review the content they submit, and sell for delivery, booking or payment at the counter.', 'Your listings, prices and offers are accurate and current, and you honour them. You show the total price clearly. You deal fairly with creators and shoppers.'],
              ['Creator', 'Receive campaign offers, accept or decline them, submit content, publish offers to your storefront, and earn commission on the sales you drive.', 'You disclose paid and gifted relationships, and your opinion is genuine. You follow the [Community Guidelines](/legal/community-guidelines). You are independent, not our employee.'],
              ['Shopper', 'Discover offers through creator storefronts and share links, order, book, or pay at the store.', 'The details you give us are accurate, and you pay for what you order. You do not abuse offers, returns or the complaint process.'],
            ],
          },
        },
        { p: 'A contract for goods or services is between the shopper and the brand. A collaboration is between the brand and the creator. We provide the platform on which they happen.' },
      ],
    },
    {
      id: 'acceptable-use',
      heading: 'Acceptable use',
      blocks: [
        { p: 'Use INFLX for what it is for. Whichever role you are in, you must not:' },
        {
          ul: [
            'Fake engagement — bought followers, bots, paid likes or comments, or fabricated performance figures.',
            'Manipulate attribution or commission, including placing orders through your own storefront.',
            'Post fake or incentivised reviews, or pose as an ordinary customer when you were paid or gifted.',
            'Use someone else\'s account, or buy, sell or share accounts.',
            'Scrape, reverse engineer, probe our security, or automate access without our written permission.',
            'Use INFLX for anything unlawful, or help someone else do so.',
          ],
        },
        { p: 'Applicable law also requires us to tell you what you may not host, upload, publish or share on INFLX. Do not post anything that is:' },
        {
          ul: [
            'Not yours to use, or that infringes a patent, trademark, copyright or other proprietary right.',
            'Obscene, pornographic or paedophilic.',
            'An invasion of another person\'s privacy, including bodily privacy.',
            'Insulting or harassing on the basis of gender.',
            'Racially or ethnically objectionable.',
            'Related to money laundering or gambling.',
            'Promoting enmity between groups, or intended to incite violence.',
            'Harmful to a child.',
            'Impersonating another person, or misleading about where a message came from.',
            'Patently false or misleading, but presented as a statement of fact.',
            'A threat to the unity, integrity, defence, security or sovereignty of India, its friendly relations with foreign states, or public order.',
            'An incitement to a cognizable offence, or an obstruction to investigating one.',
            'A virus, or code designed to damage or interrupt a computer resource.',
            'In breach of any law in force.',
          ],
        },
        { p: 'We can investigate suspected breaches, hold a payout while we do, and remove anything that breaks these rules. The same rules appear in everyday language in our [Community Guidelines](/legal/community-guidelines).' },
      ],
    },
    {
      id: 'our-role',
      heading: 'Our role, and what belongs to whom',
      blocks: [
        { p: '**We are a platform, not the seller.** We do not manufacture, own, inspect or deliver the goods and services listed on INFLX. Quality, availability, delivery, warranty, returns and refunds are the brand\'s responsibility, on the terms that brand publishes. We do not guarantee sales, reach, engagement or business outcomes for anyone.' },
        { p: 'We host what our users post and we do not review everything before it goes up. We remove or disable content when we are required to do so under applicable Indian law, or when it breaks these terms. Where the law allows us to limit our liability, our total liability to you for any claim is limited to the amounts you paid us for the service the claim is about. Nothing here removes rights you have that we cannot contract out of.' },
        { p: 'The INFLX name, logo, software and design belong to {{ENTITY}}. Using INFLX gives you no ownership of it, and you may not copy, reproduce or commercially use any part of it without our written permission. Content you post stays yours — see the [Content & Intellectual Property Policy](/legal/content-ip-policy).' },
        { callout: { p: '**© {{COPYRIGHT_YEAR}} {{ENTITY}}. All rights reserved.**\nINFLX is a product of {{ENTITY}}.' } },
      ],
    },
    {
      id: 'suspension-and-termination',
      heading: 'Suspension and termination',
      blocks: [
        { p: 'We can remove content, restrict features, hold a payout, suspend your account or close it if you break these terms, the [Community Guidelines](/legal/community-guidelines) or the law, if a valid legal order requires it, or if we reasonably suspect fraud while we investigate. We tell you what rule was involved and how to appeal, unless the law stops us from doing so.' },
        { callout: { label: 'Read this part carefully', p: 'Unlawful content can attract **penalty or punishment on you personally** under applicable Indian law. That liability is yours, not ours. Where an offence must be reported, we report it and give the authorities what the law requires.' } },
        { p: 'You can close your account at any time from your settings, or by writing to {{SUPPORT_EMAIL}}. Some things survive closure — money you already owe, obligations under a signed collaboration, and records we are required to keep under applicable law.' },
      ],
    },
    {
      id: 'fees-and-money',
      heading: 'Fees and payments',
      blocks: [
        { p: 'All amounts on INFLX are in Indian rupees. Fees, commissions, holding periods, minimum amounts and similar figures are **commercial terms set by INFLX**, not fixed by this document.' },
        { p: 'We show the terms that apply to you in the app and in your dashboard, and you see them before you commit to a campaign, an offer or a withdrawal. We can change them, and when we do, we tell you in advance. A change never applies backwards to something already agreed.' },
        { p: 'Tax is deducted at source from payouts where applicable law requires it, and you must give us the tax details we ask for. We may hold a payout until they are supplied. Creators are independent suppliers, responsible for their own registrations, invoicing and filings.' },
        { p: 'Refunds follow the brand\'s published terms and normally return by the route the payment came in on.' },
      ],
    },
    {
      id: 'changes-and-governing-law',
      heading: 'Changes, governing law and disputes',
      blocks: [
        { p: 'We may update these terms from time to time. When we do, we publish the revised version on this page with a new effective date, and we notify significant changes before they take effect. If you keep using INFLX after a change takes effect, you accept it.' },
        { p: 'These terms are governed by the laws of India, and the courts at {{JURISDICTION_CITY}} have exclusive jurisdiction over any dispute arising out of them. Please raise a complaint with us first — most things are faster to fix that way. Nothing here takes away your rights as a consumer.' },
        { p: 'If a court finds any part of these terms unenforceable, the rest continues to apply. If we do not enforce something immediately, we do not lose the right to enforce it later.' },
      ],
    },
    {
      id: 'contact-and-grievance',
      heading: 'Contact us, or complain',
      blocks: [
        { p: 'Reach us at {{SUPPORT_EMAIL}} or on {{SUPPORT_MOBILE}}. We are {{ENTITY}}, CIN {{CIN}}, registered at {{REGISTERED_ADDRESS}}.' },
        { callout: { label: 'Grievance Officer', p: '{{GRIEVANCE_OFFICER}}, {{GRIEVANCE_DESIGNATION}}\n{{GRIEVANCE_EMAIL}} · {{GRIEVANCE_PHONE}}' } },
        { p: 'We acknowledge complaints **within 24 hours** and work to resolve them **within 7 days**, in line with applicable law. The full process, including how to escalate, is at [Grievance Redressal](/legal/grievance).' },
      ],
    },
  ],
  related: ['privacy', 'community-guidelines', 'grievance'],
};

export const cookies = {
  slug: 'cookies',
  title: 'Cookie Policy',
  group: 'policies',
  summary: 'The cookies and similar technologies INFLX uses, what they are for, and how to control them.',
  appliesTo: 'Anyone visiting the INFLX website or using the INFLX apps.',
  version: '1.0',
  inShort: 'We use a small number of cookies — enough to keep you signed in, remember your preferences and understand how the platform is used. We do not use cookies for behavioural advertising. You can control cookies through your browser or device settings.',
  sections: [
    {
      id: 'what-this-covers',
      heading: 'What this covers',
      blocks: [
        { p: 'This policy explains the cookies and similar technologies used on the INFLX website and in the INFLX apps, operated by {{ENTITY}}. It takes effect on {{EFFECTIVE_DATE}}.' },
        { p: 'Please read it together with our [Privacy Policy](/legal/privacy), which explains what we do with personal information more broadly and who we share it with.' },
      ],
    },
    {
      id: 'what-cookies-are',
      heading: 'What cookies are',
      blocks: [
        { p: 'A cookie is a small text file that a website asks your browser to store. When you come back, the browser hands it over again, so the site can recognise your session and remember what you chose.' },
        { p: 'Similar technologies do the same job by other means — local and session storage in your browser, tracking pixels in emails, and device identifiers or app storage on a mobile device. Where this policy says **cookies**, it means all of these. A cookie cannot run a program on your device and cannot read your files.' },
      ],
    },
    {
      id: 'what-we-use',
      heading: 'What we use cookies for',
      blocks: [
        { p: 'We use cookies to keep the platform working, to remember your choices, and to understand how it is used. In broad terms, they fall into these categories.' },
        {
          ul: [
            '**Necessary and session cookies** — keep you signed in after you enter your one-time password, hold your session, remember your cart and checkout state, and help us prevent fraud and abuse. Without these, sign-in and checkout do not work.',
            '**Preference cookies** — remember choices such as your city, language and display settings, so you do not set them again every visit.',
            '**Analytics cookies** — help us count which pages and features are used and where things load slowly, so we can improve them. This is reported to us in aggregate.',
          ],
        },
        { p: 'We do not use cookies for behavioural or targeted advertising, and we do not direct advertising at anyone under 18.' },
      ],
    },
    {
      id: 'third-party-cookies',
      heading: 'Cookies set by others',
      blocks: [
        { p: 'Some parts of INFLX are run by companies we work with, such as our payment, hosting and analytics providers. These can set their own cookies on their own terms, which we do not control.' },
        { p: 'We work with service providers who are required to act on our instructions and to protect the information we share with them. The categories of provider are listed in our [Privacy Policy](/legal/privacy). If you follow a link from INFLX to another website, that site sets its own cookies under its own policy.' },
      ],
    },
    {
      id: 'how-to-control-cookies',
      heading: 'Controlling cookies',
      blocks: [
        { p: 'Every major browser lets you see, block and delete cookies. Look under Settings, then Privacy or Site settings, in Chrome, Safari, Firefox or Edge. You can block everything, block only third-party cookies, or clear what is already stored.' },
        { p: 'On a mobile device, your device settings control advertising identifiers and app permissions — under Privacy on iOS, and under Privacy and Ads on Android. Where we offer cookie or privacy choices on the platform itself, you will find them in the settings of the website or app.' },
        { p: 'Please note that blocking necessary cookies will sign you out and stop checkout from working.' },
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      blocks: [
        { p: 'We may update this policy from time to time — for example, when we add or remove a category of cookie. When we do, we will publish the revised version on this page with a new effective date.' },
        { p: 'Where changes are significant, we will notify you through the platform or by other means.' },
      ],
    },
    {
      id: 'contact-and-grievance',
      heading: 'Contact us',
      blocks: [
        { p: 'For questions about this policy, contact us at {{SUPPORT_EMAIL}} or {{SUPPORT_MOBILE}}. We are {{ENTITY}}, registered at {{REGISTERED_ADDRESS}}.' },
        { callout: { label: 'Grievance Officer', p: '{{GRIEVANCE_OFFICER}}, {{GRIEVANCE_DESIGNATION}} · {{GRIEVANCE_EMAIL}} · {{GRIEVANCE_PHONE}}' } },
        { p: 'We acknowledge complaints **within 24 hours** and work to resolve them **within 7 days**, in line with applicable law. The full process is at [Grievance Redressal](/legal/grievance).' },
      ],
    },
  ],
  related: ['privacy', 'terms'],
};

export const community = {
  slug: 'community-guidelines',
  title: 'Community Guidelines',
  group: 'policies',
  summary: 'What you can post on INFLX, how to behave, what happens when a rule is broken, and how to appeal.',
  appliesTo: 'Everyone who posts, sells or buys on INFLX.',
  version: '1.0',
  inShort: 'Be real, say when something is paid or gifted, label images and video that AI made or changed, and never post anything unlawful. If you break a rule we act — a warning, a removal, a suspension or a closed account, depending on how serious it is. If we get it wrong, you can appeal.',
  sections: [
    {
      id: 'who-these-rules-apply-to',
      heading: 'What INFLX is for',
      blocks: [
        { p: 'INFLX is a place where brands run campaigns, creators promote offers to their own followers, and shoppers buy through creator storefronts. These guidelines keep that useful and honest for everyone. They apply to brands, creators and shoppers alike, and cover what you post, what you sell, the reviews you write and how you treat other people. This version takes effect on {{EFFECTIVE_DATE}}.' },
        { p: 'They are part of our [Terms of Use](/legal/terms). Breaking a guideline is breaking the terms. If something here is unclear, ask us at {{SUPPORT_EMAIL}} before you post, not after.' },
      ],
    },
    {
      id: 'be-authentic',
      heading: 'Be authentic',
      blocks: [
        { p: 'The platform only works if numbers and opinions are real. So:' },
        {
          ul: [
            'Do not buy followers, likes, views or comments, and do not use engagement pods, bots or click farms.',
            'Do not fabricate or edit your audience or performance figures.',
            'Do not write or arrange fake reviews, and do not review something you have not used.',
            'Do not pose as an ordinary customer when you were paid, gifted or otherwise connected to the brand.',
            'Do not create extra accounts, sell or rent your account, or use someone else\'s identity.',
            'Do not place orders through your own storefront, or arrange for others to, in order to generate commission for yourself.',
          ],
        },
        { p: 'Where we find this, we can remove the content, reverse the commission it earned, and act on the account.' },
      ],
    },
    {
      id: 'promote-honestly',
      heading: 'Disclose paid promotions',
      blocks: [
        { p: 'If you were paid, gifted, discounted or otherwise connected to what you are promoting, say so. Put the disclosure where people will see it, before they read or watch the rest — not only in your bio, at the end of a post, or buried in hashtags.' },
        { p: 'This applies even when nobody asked you to mention the product and the opinion is genuinely your own. Your opinion should be honest and based on real experience of the product. If you give specialist advice about finance or health, say what qualifies you to give it.' },
        { p: 'The detailed rules on labels and placement are at [Advertising Disclosure](/legal/advertising-disclosure). The duty sits on the brand as well as the creator, and undisclosed endorsements can attract penalties under applicable Indian law.' },
      ],
    },
    {
      id: 'declare-ai-content',
      heading: 'Declare AI-generated content',
      blocks: [
        { p: 'If any part of an image, video or audio you post was generated or meaningfully altered by AI, declare it when you upload and keep the label visible on the content. This covers fully AI-generated visuals, AI-generated product shots or models, altered faces and bodies, objects added or removed, and synthetic voiceovers.' },
        { p: 'Ordinary cropping, colour correction and standard filters do not need a declaration. Removing or hiding a label that has been applied is itself a breach.' },
        { p: 'Never use AI to make a real person appear to say or do something they did not, or to alter someone\'s face or body without their consent. That content is not allowed at all.' },
      ],
    },
    {
      id: 'respect-and-safety',
      heading: 'Respect and safety',
      blocks: [
        { p: 'Disagreeing with someone is fine. The following is not.' },
        {
          ul: [
            'Harassment, bullying, threats, or organising a pile-on against someone.',
            'Hate speech, or attacking a person on the basis of religion, caste, gender, sexual orientation, disability, ethnicity or region.',
            'Publishing someone\'s private information — address, phone number, documents — without their consent.',
            'Sexual content, and anything that sexualises, endangers or exploits a child.',
            'Sharing a person\'s intimate images, or morphed images of them.',
            'Impersonating a brand, a creator or any other person.',
            'Encouraging self-harm, dangerous stunts, or unsafe use of a product.',
          ],
        },
        { p: 'Brands are responsible for what is posted from their accounts and outlets. Creators are responsible for the comment sections they moderate on a paid campaign post.' },
      ],
    },
    {
      id: 'what-you-must-not-post',
      heading: 'What you must not post',
      blocks: [
        { p: 'Do not post anything unlawful, obscene, harmful to a child, invasive of someone\'s privacy, or that infringes another person\'s intellectual property. Do not post anything that misleads about where it came from, impersonates someone, or is designed to damage a computer system.' },
        { p: 'The full list of content that may not be hosted or shared on INFLX is set out in our [Terms of Use](/legal/terms). Copyright complaints are handled separately — see [Copyright](/legal/copyright).' },
      ],
    },
    {
      id: 'what-happens-if-you-break-a-rule',
      heading: 'What happens if you break a rule',
      blocks: [
        { p: 'We look at what was posted, whether it seems deliberate, whether anyone was harmed, and what your history is. Then we act proportionately. Serious cases go straight to the bottom row.' },
        {
          table: {
            head: ['What we do', 'When'],
            rows: [
              ['A warning telling you which rule was involved and what to change.', 'A first, minor breach that looks unintentional.'],
              ['We remove the post, listing, offer or review, and tell you why.', 'The content breaks these rules, or a valid complaint or legal order requires removal.'],
              ['We limit features or hold a payout for a period.', 'Repeated breaches, or while we investigate suspected fraud or fake engagement.'],
              ['We suspend the account. Campaigns stop and the storefront goes offline.', 'Serious breaches, or repeated breaches after a warning.'],
              ['We close the account permanently.', 'Unlawful content, fraud, anything involving the exploitation of a child, or persistent breaches.'],
            ],
          },
        },
        { p: 'Unlawful content can attract penalty or punishment on you personally under applicable Indian law, and that liability is yours. Where the law requires an offence to be reported, we report it. We keep removed content and the related records for as long as applicable law requires.' },
      ],
    },
    {
      id: 'reporting-and-appeals',
      heading: 'Reporting something, and appeals',
      blocks: [
        { p: 'Every post, listing, offer, review and profile on INFLX has a report option. Tell us the link, what the problem is and how to reach you — we need those details to act. You can also write to {{GRIEVANCE_EMAIL}}. Please do not use the report tool to attack a competitor; repeated bad-faith reports are themselves a breach.' },
        { p: 'If we remove your content or act on your account, we tell you which rule was involved and how to appeal, unless a legal order stops us. Reply to that notice and a different person will review the decision. If we were wrong, we put things back.' },
        { callout: { label: 'Grievance Officer', p: '{{GRIEVANCE_OFFICER}}, {{GRIEVANCE_DESIGNATION}} · {{GRIEVANCE_EMAIL}} · {{GRIEVANCE_PHONE}}\n{{ENTITY}}, {{REGISTERED_ADDRESS}}' } },
        { p: 'We acknowledge complaints **within 24 hours** and work to resolve them **within 7 days**, in line with applicable law. The full process, and how to escalate further, is at [Grievance Redressal](/legal/grievance). General questions go to {{SUPPORT_EMAIL}} or {{SUPPORT_MOBILE}}.' },
      ],
    },
  ],
  related: ['terms', 'advertising-disclosure', 'grievance'],
};

export default { privacy, terms, cookies, community };
