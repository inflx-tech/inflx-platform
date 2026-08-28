# Expected outputs

| # | Assertion |
|---|---|
| R-1 | A `draft` campaign opens the builder |
| R-2 | So does `pending_wallet` — still unfinished |
| R-3 | `published`, `active`, `live`, `completed`, `cancelled` open the dashboard |
| R-4 | An unknown or missing status falls back to the dashboard, and never throws |
| R-5 | Both destinations are in the **same navigator** as the list |
| D-1 | A creator whose agreement is no longer live is removed when the set opens |
| D-2 | The drop cannot run before the live list has loaded |
| D-3 | It never happens silently — she is named, with the reason |
| D-4 | Everyone still live is kept |
| D-5 | Ids are compared as strings, not by identity |
| D-6 | The server list it trusts is genuinely only live agreements |
| N-1 | The publish gate still refuses a dead agreement |
| N-2 | The expiring-agreement warning is unchanged |
| N-3 | `Packages/Mobile` jest stays green — currently 44 suites / 492 tests |
