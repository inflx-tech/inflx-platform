# Impact

**Verdict: one word, plus a guard. Creator app only, OTA only, no backend, no migration.**

| Target | What |
|---|---|
| OTA — creator app | the fix |
| Backend | nothing |
| Brand app | nothing |

**Rollback** is an OTA to the previous bundle — which restores the crash, so there is no
sensible reason to.

**Shipped before this contract was written.** The app was crashing for creators in
production; the fix went out as OTA **v183** the moment it was verified, and the contract
followed within minutes. Recorded plainly rather than backdated: governance blocked the
*commit*, correctly, and the answer was to write the contract, not to override.

**Two days of exposure.** Live from 24 August. Any creator who tried to counter a brand
request in that window lost the app. Nobody reported it, which is its own finding — the
practice creators are not walked often enough for a crash to surface quickly.
