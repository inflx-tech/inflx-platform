# Impact

**Frontend-only, mobile (brand) — OTA. Zero behaviour change (dead-code removal).**

Blast radius verified BEFORE deleting: the screen used only brandApi.getMe (7 other users),
and its Home tile was the sole restaurantOnly consumer.

Risk: very low. The follower food subsystem is deliberately untouched (own decision needed).

Release: production-impacting via OTA → founder go.
