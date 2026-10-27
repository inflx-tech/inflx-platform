# Expected outputs — Web Campaigns tab as a monitor

> What QA asserts. "Compiles" is not an output. `next build` exit 0 is the floor, not the proof.

## Per-step expected outputs

| Step | Observable output | How verified |
|---|---|---|
| E1 | `/dashboard/campaigns` makes exactly one campaign call: `GET /v1/campaigns/summary?state=live&limit=50` on load; switching segment calls `state=draft` / `state=past` | Playwright network capture |
| E2 | Segment counts equal the response `tabs.live/draft/past` | Playwright text vs intercepted JSON |
| E3 | A live card shows chip "Live"; a draft card "Draft" + "no invitations sent"; a past card "Completed" or "Expired" | Playwright, seeded via the phone's own endpoints (`POST /campaigns`, `POST .../sets`, `POST .../invitations`) |
| E4 | The words "New campaign", "Continue draft", "Export CSV", "Sign all", "Pending wallet", "Published", "Cancelled", "Total budget" do not appear anywhere on the list page | Playwright `getByText` count 0 |
| E5 | No `POST`/`DELETE`/`PATCH` leaves the list page during the whole workflow | Playwright request listener |
| E6 | Hub loads `GET /v1/campaigns/:id/summary` and never `GET /v1/campaigns/:id` nor `/campaigns/:id/escrow` | network capture |
| E7 | Set row shows Aim word (Pay for Sale / Pay for Content / Hybrid), mode word (Store Visit / Remote), posting date in `d Mon yyyy`, and the cutoff line | text assertions vs response |
| E8 | Clicking a set row calls `GET /v1/campaigns/:id/sets/:sid/summary`; drawer group titles are exactly the server's `groups[key].title` in `order` | network + text |
| E9 | Drawer Posts tab appears only when `set.goal !== 'engagement'`; it calls `GET .../sets/:sid/posts` and renders `totals.you_receive` as rupees | Playwright |
| E10 | "Update now" posts to `/brands/me/campaigns/:id/engagement/refresh` and is the only write the hub can make; it is disabled when `canUpdate` is false | Playwright |
| E11 | Hub and drawer contain none of: "Fund wallet", "Publish", "End campaign", "Counter-sign", "Sign contract", "Approve", "Reject", "Send counter", "Invite more", "Manage logistics", "Regenerate" | `getByText` count 0 |
| E12 | `/dashboard/campaigns/:id/influencers`, `/sets`, `/reviews`, `/escrow` each redirect to `/dashboard/campaigns/:id` | Playwright URL after navigation |
| E13 | Dashboard home "Live campaigns" tile equals `tabs.live` from `GET /campaigns/summary`; `GET /v1/campaigns` is no longer called from home | network + text |
| E14 | Dashboard home quick action text is "Campaigns", href `/dashboard/campaigns` | text + attribute |
| E15 | Listings publish step card text contains "on the phone" and no element links to a create | text |
| E16 | Creator profile page has no "Invite" button and no `POST .../sets/:sid/invite` is reachable | text + grep |
| E17 | Another brand's campaign id → hub shows "Not found" and a link to `/dashboard/campaigns`; no other panel errors | Playwright with a second seeded brand |
| E18 | A 500 injected on `/engagement` → the Numbers block shows "Not available right now" while the Sets block still renders the set names | Playwright route fulfil |
| E19 | `grep -rn` across `Packages/brand-web` finds no call to `/publish`, `/cancel`, `/end`, `/bulk-sign`, `/brand-sign`, `/approve-application`, `/reject-application`, `/sets/${'${'}sid}/invite`, `productionApi.`, `deliverableApi.` inside `app/dashboard/campaigns/**`, `app/dashboard/page.js`, `app/dashboard/influencers/[id]/page.js`, `products/components/builtinStepComponents.js` | repo grep, recorded in 06-diff/notes.md |
| E20 | `next build` exit 0 | build log |

## Data assertions (post-workflow)
- Zero rows change in `campaigns`, `campaign_sets`, `campaign_influencers`, `contracts`,
  `escrow_entries`, `wallet_transactions` across Workflows A–C (compare `updated_at` / counts
  before and after on the test DB).
- The one write, engagement refresh, touches only `post_stat_runs` and `post_stats` rows.

## Visual evidence required
- Before/after of: the list (Live segment), the hub, the set drawer (creators), the drawer Posts
  tab, Dashboard home top row, creator profile page header. Captured by the before/after-diff
  machinery against the locked mockups in `04-preview/mockups/`.
- Network panel export for the list and the hub, showing the call set in E1/E6/E8/E10 and nothing
  from §6.7 of the spec.
