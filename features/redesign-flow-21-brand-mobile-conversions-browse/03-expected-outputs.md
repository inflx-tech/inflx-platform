# Expected Outputs — Flow 21

## Component API (NEW)

### `<StatusPill status />`
Single prop `status` (string). Internal map (immutable export):
- new/submitted/sent → yellowPale/yellowText
- contacted/viewed/responded → infoPale/info
- countered → convPale/conv
- converted/accepted/completed → successPale/successText
- rejected/declined/cancelled → dangerPale/dangerText
- closed/expired/withdrawn/refunded/pending → bg2/muted2 (with `pending` overridden to yellowPale/yellowText for transaction context — handled by an optional `mode` prop, default = 'default')

Renders: 9×3 px JetBrains-Mono-Bold pill with letter-spacing 0.3, uppercase.

### `<EmptyState icon title sub />`
Three props (icon = mono placeholder text like `[$]`, title = string, sub = string).
Renders: 52×52 yellowPale tile + Outfit-Bold title + PJS Medium sub. Dashed yellowPale border card.

### `<ScreenHeader title sub back onBack count countLabel />`
Renders ink topbar with:
- title (Outfit-Bold 22, white)
- 30×3 yellow rule
- optional `sub` (PJS Medium 11 muted-white) OR `count` chip (mono bold yellow on translucent-white)
- optional `back` (boolean) + `onBack` (callback) — renders "‹ Back" link OR back-arrow circle when no title (variant decision: presence of `sub` → "‹ Back" link, absence → centred-title + back-arrow-circle)

## Per-step outputs

### Conversions
| Step | Output |
|---|---|
| 1 | ScreenHeader with sub | derived from campaignId param |
| 3 | 4 summary tiles in 2-col grid, mono digits ink, uppercase mono labels |
| 3 | 3 channel tiles in bg2 with mono counts |
| 4 | Transaction cards: type label mono ink uppercase + StatusPill + body |
| 5 | Expanded detail rows: muted label + ink value + bold rows for Customer paid / Your net |
| 7 | EmptyState with `[$]` icon |

### InfluencerBrowse
| Step | Output |
|---|---|
| 1 | ScreenHeader with sub |
| 2 | Search bar: white input + ink button "Search" |
| 3 | 7 sort chips horizontal scroll; active = ink + yellow mono |
| 4 | Filter card: niche chips (small) + tier chips + 2-col min-followers/min-ER inputs + city + Clear/Apply buttons |
| 5 | Result cards: 44px yellow circle + Outfit handle + tier pill yellowPale + stats mono |
| 7 | EmptyState with `[NONE]` icon |

## Data assertions
- Conversions: `summary` totals derived from existing endpoint shape, rendered as `fmtMoney(rupees)`
- InfluencerBrowse: response normalization preserved (`creators[]` || `influencers[]` → unified `id/instagram_handle/verified/engagement_rate`)

## Visual evidence
`design/wave2/flow-21-brand-mobile-conversions-browse/web.html` — 2 phones + component callouts panel
