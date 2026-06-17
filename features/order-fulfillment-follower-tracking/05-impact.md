# 05 — Impact: Follower Order Tracking (Unit 4)

**Verdict: mobile screen rebuild + a small additive getOrder SELECT extension. No
migration. No change to order/payment/commission logic.**

## Mechanics
- `screens/follower/OrderDetailScreen.js`: progress tracker + separate Timeline/Tracking
  cards → one vertical 5-step timeline + a Shipment card (courier/AWB/track link via
  Linking) + via-@creator. Items/address/return/prebook blocks preserved.
- `transaction.controller.getOrder`: SELECT += transaction_type (fixes latent Return-CTA
  bug), composed delivery_address (LEFT JOIN follower_addresses), creator_handle/name
  (LEFT JOIN ci→influencers→users). Step columns already via fo.*.

## Blast radius
- One follower screen + one read endpoint's SELECT (additive columns). No write paths
  touched.
- Deploy-class: production-impacting (Render backend + mobile OTA). No migration.
  released=false until founder device verify.
- Risk: low. The getOrder additions are LEFT JOINs (null-safe); the screen degrades
  gracefully when courier/timestamps are absent (older orders).
