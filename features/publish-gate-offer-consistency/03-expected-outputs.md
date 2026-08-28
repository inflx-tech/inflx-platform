# Expected outputs

| # | Assertion |
|---|---|
| G-1 | `NO_SHOPPER_OFFER` is a **warning** on the server |
| G-2 | `NO_SHOPPER_OFFER` is a **warning** on the phone |
| G-3 | It is satisfied by an offer on **any creator's row** |
| G-4 | The four real blockers still block: no allocation, empty allocation, missing agreement, dead agreement |
| G-5 | `EMPTY_SET` and `NO_SHOPPER_OFFER` from the server are dropped until the campaign is published |
| G-6 | Everything else the server says still reaches the screen |
| G-7 | The expiring-agreement warning is unchanged |
| G-8 | The wizard has **one** offer control, on her row |
| G-9 | The set-level picker, its state, its handlers, its offers fetch and its builder mount are gone |
| G-10 | *See what a shopper pays* survives, on her sheet, priced against her commission |
| G-11 | A draft saved before this change still publishes with its set-level offer |
| G-12 | `Packages/Mobile` jest stays green — currently 42 suites / 455 tests |
