# Workflow — an admin opens a pending account

## Golden path, brand

1. Admin opens **Brands**, clicks Preeti chouhan.
2. The header reads **Preeti chouhan** — the business — with the contact name below it,
   and a status pill reading **Pending**.
3. The facts she supplied are on screen: category, contact, phone, applied date,
   **House no. 225/7**, **Karnal — 132001**, and the pin she dropped.
4. GST reads **Not provided**, because she did not give one. That is a fact, not a blank.

## Golden path, creator

1. Admin opens a creator by id.
2. Handle, city, followers and engagement as today — plus **phone**, **joined**, **last
   checked against Instagram**, and wallet and pending balances **in rupees**.
3. If she has never been scraped, "Last checked" says so rather than showing a dash.

## The boundary that must hold

A **brand** calling `GET /influencers/:id` sees exactly what it sees today. It must never
receive phone, wallet balance, pending balance or TDS settings. This is checked, not
assumed — the test asserts a brand's response does NOT contain those keys.

## Expected end state

* No dash on either page where the platform holds a value.
* A brand's name is the business, never the person.
* Money reads as the amount actually owed.
* Nothing new is visible to a brand.
