# Flow 42 (F3) — Workflow prediction

Green-signaled F3 mockup at `04-preview/mockups/web.html`. Tiles → source:

## PayAtStore
| Element | Source |
|---|---|
| Store / creator | route.params brand/store/influencer |
| Discount % | offer.discount_value OR prebook atVenueDiscountPct |
| Breakdown | client math: bill, bill×pct, bill−disc, −token, you_pay |
| Receipt | verifyPayAtStore → transaction.reference_code |

## OnlineOrder
| Element | Source |
|---|---|
| Cart items | route.params.products |
| Addresses | followerApi.getAddresses() |
| Place order | createOrder({items, delivery_address_id, tracking}) |

## OrderCart
| Element | Source |
|---|---|
| Items | useCart() context |
| Min-order / delivery | brandData.min_order_value / delivery_fee |
| Checkout | createOrder({tracking, items, delivery_fee}) → processPayment → verifyOrder |

## Zero phantom
Every value traces to route params, useCart context, or a real follower API.
Razorpay amounts derived from real bill/cart totals (paise only at SDK boundary).
