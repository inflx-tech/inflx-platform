# item15-hybrid — impact
**Production-impacting, and it moves money** — the second 25% and the final 50% of a Hybrid fixed
amount, from money locked at signing, through item 9/12's release path unchanged
(`contentMoney.releaseSecond`, the tranche-3 job). No migration (item 14's 199 already holds every
column and stage). Backend (Render) and OTA brand + influencer. Explicit go before push / OTA.

- **Creators:** a Hybrid collaboration after the shoot opens Going live (item 14's two paths) with a
  payments card; confirmation pays her second instalment; the final one arrives on a date; she can
  ask INFLX to look after 7 days of silence.
- **Brands:** the confirm button names the amount it pays; the card shows what is still locked.
- **Admin:** two setting descriptions now say they apply to Hybrid; no new number.
- **At deploy:** production holds 2 Hybrid collaborations, both old terms (test data, H1) — they
  stay exactly as they are; no money moves at deploy.
- **Behaviour change outside Hybrid:** none. `releaseFinal` branches on the Aim; Pay for Content's
  completion is unchanged.
